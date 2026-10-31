/** Backend-only governed native middleware. No caller is wired and the actual trust root is empty.
 * Production composition MUST supply a private durable terminal sink; no missing RPC is invented.
 * Tools/schema/Responses and typed native replay remain later qualification gates. */
import { ConvexError } from "convex/values";
import { convexGateway } from "@convex-dev/ai-sdk-provider";
import { wrapEmbeddingModel, wrapLanguageModel } from "ai";
import { canonicalModelJson, validateModelRequest } from "../src/domain/model-policy";
import { assertEmbeddingVector, assertProfileMatches, DEFAULT_EMBEDDING_PROFILE, normalizeSourceText } from "../src/domain/profile";
import { qualifiedTerminalModelId } from "./runtimeModelPolicyBootstrap";
import { FACTS_JSON_SCHEMA } from "../src/domain/extraction";
import { CONFLICT_DECISION_JSON_SCHEMA } from "../src/domain/conflicts";
export const DEFAULT_GATEWAY_OWNED_TIMING = Object.freeze({ terminalObservationMs: 100, terminalPersistenceMs: 1000, cleanupMs: 100 });
export class GatewayDispatchError extends Error {
    constructor(code) {
        super("Governed model call did not complete for delivery.");
        this.code = code;
        this.name = "GatewayDispatchError";
    }
}
function fail(code) { throw new GatewayDispatchError(code); }
const utf8 = (text) => {
    for (const point of text) {
        const n = point.codePointAt(0);
        if (n >= 0xd800 && n <= 0xdfff)
            fail("INVALID_UNICODE");
    }
    return new TextEncoder().encode(text).length;
};
const count = (value) => Number.isSafeInteger(value) && value >= 0;
/** Capture descriptors before projection; optional undefined SDK fields are only allowed by name. */
function record(input, keys) {
    if (!input || typeof input !== "object" || Array.isArray(input))
        return fail("INVALID_NATIVE_REQUEST");
    const prototype = Object.getPrototypeOf(input);
    if (prototype !== Object.prototype && prototype !== null)
        fail("INVALID_NATIVE_REQUEST");
    const result = Object.create(null);
    for (const key of Reflect.ownKeys(input)) {
        if (typeof key !== "string" || !keys.includes(key))
            fail("UNSUPPORTED_NATIVE_FIELD");
        const d = Object.getOwnPropertyDescriptor(input, key);
        if (!d.enumerable || !("value" in d))
            fail("INVALID_NATIVE_REQUEST");
        if (d.value !== undefined)
            Object.defineProperty(result, key, { value: d.value, enumerable: true });
    }
    return result;
}
function arrayValues(input) {
    if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype)
        fail("INVALID_NATIVE_REQUEST");
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Reflect.ownKeys(input).some((key) => typeof key !== "string" || (key !== "length" && !/^(0|[1-9]\d*)$/.test(key))))
        fail("INVALID_NATIVE_REQUEST");
    const values = [];
    for (let i = 0; i < input.length; i++) {
        const d = descriptors[String(i)];
        if (!d || !d.enumerable || !("value" in d))
            fail("INVALID_NATIVE_REQUEST");
        values.push(d.value);
    }
    if (Object.keys(descriptors).length !== values.length + 1)
        fail("INVALID_NATIVE_REQUEST");
    return values;
}
function stableId(value) {
    if (typeof value !== "string" || value.length < 1 || value.length > 256 || value.trim() !== value)
        return false;
    utf8(value);
    return true;
}
/** Source is detached before any await; never normalized or inferred from prompt/model claims. */
function detachedBinding(input) {
    const fields = record(input, ["reference", "operationKey", "runBudgetId", "semanticId", "ordinal", "source", "parentOperationId"]);
    if ("source" in fields) {
        const source = record(fields.source, ["sourceId", "sourceEventId", "sourceRevision", "contentHash"]);
        if (Object.keys(source).length !== 4 || !stableId(source.sourceId) || !stableId(source.sourceEventId)
            || !count(source.sourceRevision) || source.sourceRevision < 1 || typeof source.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(source.contentHash))
            fail("INVALID_SOURCE");
    }
    return detached(fields);
}
function checkedResolution(input) {
    const fields = record(input, ["snapshot", "dispatchEvidence", "storageLimits"]);
    if (Object.keys(fields).length !== 3)
        fail("CAPABILITY_UNAVAILABLE");
    return detached(fields);
}
function checkedAdmission(input) {
    const fields = record(input, ["status", "operationId", "attemptId", "snapshot", "requestCanonical", "resultCanonical", "replayAllowed"]);
    if (!stableId(fields.operationId))
        fail("ADMITTED_REQUEST_MISMATCH");
    const keys = Reflect.ownKeys(input);
    const exact = (allowed, required) => keys.every((key) => typeof key === "string" && allowed.includes(key)) && required.every((key) => key in fields);
    if (fields.status === "reserved" && exact(["status", "operationId", "attemptId", "snapshot", "requestCanonical"], ["attemptId", "snapshot", "requestCanonical"])
        && stableId(fields.attemptId) && typeof fields.requestCanonical === "string")
        return detached(fields);
    if (fields.status === "replay" && exact(["status", "operationId", "resultCanonical"], ["resultCanonical"]) && typeof fields.resultCanonical === "string")
        return detached(fields);
    if (["uncertain", "inflight"].includes(fields.status) && exact(["status", "operationId", "attemptId", "replayAllowed"], ["attemptId"])
        && stableId(fields.attemptId) && (!keys.includes("replayAllowed") || fields.replayAllowed === false))
        return detached(fields);
    return fail("ADMITTED_REQUEST_MISMATCH");
}
function checkedPermit(input) {
    const fields = record(input, ["dispatchPermit", "dispatchIdentity", "snapshot", "requestCanonical", "state", "replayAllowed"]);
    const keys = Reflect.ownKeys(input);
    if (fields.dispatchPermit === true && keys.length === 4 && ["dispatchPermit", "dispatchIdentity", "snapshot", "requestCanonical"].every((key) => key in fields)
        && stableId(fields.dispatchIdentity) && typeof fields.requestCanonical === "string")
        return detached(fields);
    if (fields.dispatchPermit === false && keys.length === 3 && typeof fields.state === "string" && fields.replayAllowed === false)
        return { dispatchPermit: false, state: fields.state, replayAllowed: false };
    return fail("CHECKPOINT_MISMATCH");
}
function captureAcknowledgment(input) {
    const ack = record(input, ["evidenceId", "state", "settledCostUnits", "overrun"]);
    if (!stableId(ack.evidenceId))
        fail("TERMINAL_CAPTURE_PENDING");
    // Missing accounting fields are not projected to a fabricated settled state.
    if (Reflect.ownKeys(input).length === 1)
        return { evidenceId: ack.evidenceId };
    if (!["settled", "confirmed_rejected", "uncertain"].includes(ack.state) || typeof ack.overrun !== "boolean"
        || ("settledCostUnits" in ack && !count(ack.settledCostUnits)))
        fail("TERMINAL_CAPTURE_PENDING");
    // Explicit undefined is not a valid optional native accounting value.
    if (Object.getOwnPropertyDescriptor(input, "settledCostUnits") && !count(ack.settledCostUnits))
        fail("TERMINAL_CAPTURE_PENDING");
    return ack;
}
function attachmentAcknowledgment(input) {
    const ack = record(input, ["attached", "resultWithheld"]);
    if (Reflect.ownKeys(input).length !== 2 || typeof ack.attached !== "boolean" || typeof ack.resultWithheld !== "boolean"
        || (!ack.attached && !ack.resultWithheld))
        fail("TERMINAL_RECONCILIATION_PENDING");
    return { attached: ack.attached, resultWithheld: ack.resultWithheld };
}
/** Only the exact native structured conflict is definitive, never remote message text. */
function attachmentConflict(error) {
    try {
        if (!(error instanceof ConvexError) || Object.getPrototypeOf(error) !== ConvexError.prototype)
            return false;
        const descriptor = Object.getOwnPropertyDescriptor(error, "data");
        if (!descriptor || !("value" in descriptor))
            return false;
        const data = record(descriptor.value, ["version", "code", "message", "retryable", "outcome"]);
        return data.version === 1 && data.code === "IDEMPOTENCY_CONFLICT" && data.retryable === false;
    }
    catch {
        return false;
    }
}
function detached(value) { return JSON.parse(canonicalModelJson(value)); }
function exactJSON(encoded, maximum) {
    if (utf8(encoded) > maximum)
        fail("RESULT_BOUND_EXCEEDED");
    const value = JSON.parse(encoded);
    if (canonicalModelJson(value) !== encoded)
        fail("CANONICAL_MISMATCH");
    return value;
}
function json(encoded, maximum) {
    const result = canonicalModelJson(encoded);
    if (utf8(result) > maximum)
        fail("RESULT_BOUND_EXCEEDED");
    return result;
}
/** Outward microUSD decimal: exact decimal strings stay exact; IEEE numbers are rounded UP
 * from their upper adjacent representable value, then to integer microUSD. No exponent/NaN. */
export function conservativeUsdDecimal(value) {
    if (typeof value === "string")
        return /^\d+(?:\.\d+)?$/.test(value) && value.length <= 80 ? value : undefined;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || Object.is(value, -0))
        return undefined;
    if (value === 0)
        return "0";
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, value);
    const bits = view.getBigUint64(0) + 1n;
    const exponent = Number((bits >> 52n) & 0x7ffn);
    if (exponent === 0x7ff)
        return undefined;
    const significand = (bits & ((1n << 52n) - 1n)) + (exponent ? 1n << 52n : 0n);
    const power = (exponent || 1) - 1023 - 52;
    const numerator = significand * 1000000n * (power >= 0 ? 1n << BigInt(power) : 1n);
    const denominator = power < 0 ? 1n << BigInt(-power) : 1n;
    const units = (numerator + denominator - 1n) / denominator;
    if (units > BigInt(Number.MAX_SAFE_INTEGER))
        return undefined;
    return `${units / 1000000n}.${(units % 1000000n).toString().padStart(6, "0")}`;
}
function proofFor(resolution, now) {
    const { snapshot: s, dispatchEvidence: p, storageLimits: limits } = resolution;
    if (qualifiedTerminalModelId(p) === undefined || p.receiptId !== s.qualificationReceiptId || p.modelId !== s.modelId || p.nativeInterface !== s.nativeInterface
        || p.providerVersion !== "0.2.1" || p.priceRevision !== s.pins.priceRevision || p.boundRevision !== s.pins.boundRevision
        || p.checkedAt > now || p.expiresAt <= now || p.terminalProof !== "provider-terminal-v1"
        || ![p.evidenceHash, p.inputBound.nativeTransformHash, p.inputBound.documentHash, p.inputBound.proofHash, p.resultBound.proofHash].every((h) => /^[a-f0-9]{64}$/.test(h))
        || p.inputBound.revision !== 1 || !count(p.resultBound.maximumOutputTokens) || !count(p.resultBound.maximumPrivateResultBytes)
        || p.resultBound.maximumPrivateResultBytes < 1 || p.resultBound.maximumPrivateResultBytes > 60_000
        || !count(limits.canonicalBytes) || limits.canonicalBytes < 1 || !count(limits.privateResultBytes) || limits.privateResultBytes < 1 || limits.canonicalBytes > 180_000 || limits.privateResultBytes > 60_000 || limits.embeddingValuesPerCall !== 1 || p.resultBound.maximumEmbeddingValues !== 1)
        fail("CAPABILITY_UNAVAILABLE");
    if (s.nativeInterface === "chat" && p.inputBound.ruleId === "plain-chat-cookbook-utf8-v1" && p.inputBound.featureEnvelope === "plain-chat-v1")
        return;
    if (s.nativeInterface === "embedding" && p.inputBound.ruleId === "default-embedding-utf8-v1" && p.inputBound.featureEnvelope === "default-embedding-v1") {
        assertProfileMatches(s.semanticProfile);
        return;
    }
    fail("CAPABILITY_UNAVAILABLE");
}
function requestBase(s, binding) {
    return { semanticId: binding.semanticId, childCallId: "pending-server-identity", texts: [], inputTokens: 1, outputTokens: 0,
        toolSteps: 0, timeoutMs: s.limits.timeoutMs, reservationUnits: s.costBound.maximumCostUnits, tools: [], options: { maxRetries: 0 },
        promptVersion: s.pins.promptVersion, schemaVersion: s.pins.schemaVersion, extractionVersion: s.pins.extractionVersion, toolRegistryVersion: s.pins.toolRegistryVersion };
}
const standardKeys = ["prompt", "maxOutputTokens", "temperature", "topP", "seed", "stopSequences", "topK", "presencePenalty", "frequencyPenalty", "responseFormat", "tools", "toolChoice", "headers", "providerOptions", "reasoning", "includeRawChunks", "abortSignal"];
function languageParams(input, s, p, binding, signal) {
    const native = record(input, standardKeys);
    for (const key of ["topK", "presencePenalty", "frequencyPenalty", "tools", "toolChoice", "headers", "providerOptions", "reasoning", "includeRawChunks"])
        if (key in native)
            fail("UNSUPPORTED_NATIVE_FIELD");
    if (native.abortSignal !== undefined && native.abortSignal !== signal)
        fail("UNTRUSTED_ABORT_SIGNAL");
    if (native.responseFormat !== undefined && canonicalModelJson(native.responseFormat) !== '{"type":"text"}')
        fail("CAPABILITY_UNAVAILABLE");
    if (!Array.isArray(native.prompt))
        fail("INVALID_NATIVE_REQUEST");
    // Canonical validation catches sparse/custom-iterator arrays BEFORE map/iteration.
    const messages = arrayValues(native.prompt).map((message) => {
        const m = record(message, ["role", "content", "providerOptions"]);
        if ("providerOptions" in m)
            fail("UNSUPPORTED_NATIVE_FIELD");
        if (!["system", "user", "assistant"].includes(m.role))
            fail("CAPABILITY_UNAVAILABLE");
        let text;
        if (m.role === "system")
            text = m.content;
        else {
            const parts = arrayValues(m.content);
            if (parts.length !== 1)
                fail("CAPABILITY_UNAVAILABLE");
            const part = record(parts[0], ["type", "text", "providerOptions"]);
            if (part.type !== "text" || "providerOptions" in part)
                fail("CAPABILITY_UNAVAILABLE");
            text = part.text;
        }
        if (typeof text !== "string")
            fail("INVALID_NATIVE_REQUEST");
        utf8(text);
        return { role: m.role, parts: [{ type: "text", text: normalizeSourceText(text) }] };
    });
    if (!count(native.maxOutputTokens) || native.maxOutputTokens === 0 || native.maxOutputTokens > p.resultBound.maximumOutputTokens)
        fail("OUTPUT_BOUND_EXCEEDED");
    const request = requestBase(s, binding);
    request.messages = messages;
    request.texts = messages.map((m) => m.parts[0].type === "text" ? m.parts[0].text : "");
    request.inputTokens = 3 + messages.reduce((n, m, index) => n + 3 + utf8(m.role) + utf8(request.texts[index]), 0);
    request.outputTokens = native.maxOutputTokens;
    // Semantic schemas come from the operation contract, never caller provider options.
    if (s.operationKey === "memory.extract") {
        if (s.pins.schemaVersion !== "facts-v1")
            fail("CAPABILITY_UNAVAILABLE");
        request.outputSchema = detached(FACTS_JSON_SCHEMA);
    }
    else if (s.operationKey === "facts.resolve") {
        if (s.pins.schemaVersion !== "conflicts-v1")
            fail("CAPABILITY_UNAVAILABLE");
        request.outputSchema = detached(CONFLICT_DECISION_JSON_SCHEMA);
    }
    for (const key of ["temperature", "topP", "seed", "stopSequences"])
        if (native[key] !== undefined)
            Object.assign(request.options, { [key]: detached(native[key]) });
    const checked = validateModelRequest(s, request).request;
    return { request: detached(checked), params: nativeLanguage(checked, signal) };
}
function nativeLanguage(request, signal) {
    return { prompt: request.messages.map((m) => m.role === "system" ? { role: "system", content: m.parts[0].text }
            : { role: m.role, content: [{ type: "text", text: m.parts[0].text }] }),
        maxOutputTokens: request.outputTokens, ...request.options.temperature !== undefined ? { temperature: request.options.temperature } : {},
        ...request.options.topP !== undefined ? { topP: request.options.topP } : {}, ...request.options.seed !== undefined ? { seed: request.options.seed } : {},
        ...request.options.stopSequences ? { stopSequences: [...request.options.stopSequences] } : {}, abortSignal: signal };
}
function nativeIdentity(params) { const { abortSignal: _signal, includeRawChunks: _raw, ...data } = params; return canonicalModelJson(data); }
function usageOf(raw) {
    const result = {};
    for (const [key, field] of [["prompt_tokens", "inputTokens"], ["completion_tokens", "outputTokens"], ["total_tokens", "totalTokens"]])
        if (count(raw[key]))
            result[field] = raw[key];
    const prompt = raw.prompt_tokens_details;
    const completion = raw.completion_tokens_details;
    if (prompt && typeof prompt === "object" && count(prompt.cached_tokens))
        result.cachedInputTokens = prompt.cached_tokens;
    if (completion && typeof completion === "object" && count(completion.reasoning_tokens))
        result.reasoningTokens = completion.reasoning_tokens;
    return result;
}
function nativeUsage(raw) {
    const u = raw ? usageOf(raw) : {};
    return { inputTokens: { total: u.inputTokens, noCache: undefined, cacheRead: u.cachedInputTokens, cacheWrite: undefined }, outputTokens: { total: u.outputTokens, text: undefined, reasoning: u.reasoningTokens } };
}
const terminalReasons = ["stop", "length", "content_filter"];
/** Generated provider bodies are untrusted, descriptor-safe detached JSON before observation. */
function providerJSON(input) {
    try {
        const value = typeof input === "string" ? JSON.parse(input) : detached(input);
        if (!value || typeof value !== "object" || Array.isArray(value))
            return undefined;
        return value;
    }
    catch {
        return undefined;
    }
}
export async function createGovernedGatewayModel(composition, inputBinding) {
    requireSink(composition);
    const binding = detachedBinding(inputBinding);
    const resolution = checkedResolution(await composition.ledger.resolve(resolveArgs(binding)));
    proofFor(resolution, (composition.now ?? Date.now)());
    return resolution.snapshot.nativeInterface === "embedding"
        ? governGatewayEmbeddingModel(convexGateway.embeddingModel(resolution.snapshot.modelId), composition, binding, resolution)
        : governGatewayLanguageModel(convexGateway(resolution.snapshot.modelId), composition, binding, resolution);
}
function resolveArgs(binding) {
    return { reference: binding.reference, operationKey: binding.operationKey, runBudgetId: binding.runBudgetId,
        ...(binding.source ? { source: binding.source } : {}), ...(binding.parentOperationId ? { parentOperationId: binding.parentOperationId } : {}) };
}
function requireSink(composition) {
    if (!composition.terminalSink || typeof composition.terminalSink.capture !== "function")
        fail("DURABLE_TERMINAL_SINK_REQUIRED");
    if (!composition.ledger || typeof composition.ledger.attachTerminalResult !== "function")
        fail("TERMINAL_ATTACHMENT_REQUIRED");
}
function stateFor(composition, inputBinding, inputResolution) {
    requireSink(composition);
    const binding = detachedBinding(inputBinding);
    const resolution = checkedResolution(inputResolution);
    proofFor(resolution, (composition.now ?? Date.now)());
    if (!count(binding.ordinal) || !stableId(binding.semanticId) || !stableId(binding.runBudgetId))
        fail("INVALID_BINDING");
    const timing = detached(composition.ownedTiming ?? DEFAULT_GATEWAY_OWNED_TIMING);
    for (const value of [timing.terminalObservationMs, timing.terminalPersistenceMs, timing.cleanupMs])
        if (!count(value) || value < 1 || value > 1000)
            fail("INVALID_OWNED_TIMING");
    const controller = new AbortController();
    const tasks = [];
    let replay;
    let deliveryDeadline = Infinity;
    let observationDeadline = Infinity;
    let lifetimeTimer;
    const pendingRPCs = new Set();
    // Every issued operation has a retained promise and BOTH late completion handlers. A finite
    // wait does not cancel/rollback a Convex RPC; pendingWork exposes that unresolved boundary.
    // Handlers only retire observation slots: they cannot enqueue, settle again or attach output.
    function track(kind, invoke) {
        let promise;
        try {
            promise = Promise.resolve(invoke());
        }
        catch (error) {
            promise = Promise.reject(error);
        }
        const slot = { kind, promise };
        pendingRPCs.add(slot);
        promise.then(() => { pendingRPCs.delete(slot); }, () => { pendingRPCs.delete(slot); });
        return promise;
    }
    function own(invoke) {
        const task = invoke();
        const joined = task.then(() => undefined, () => undefined);
        tasks.push(joined);
        return task;
    }
    controller.signal.addEventListener("abort", () => { observationDeadline = Math.min(observationDeadline, Date.now() + timing.terminalObservationMs); });
    function startLifetime(timeoutMs) {
        assertDelivery();
        deliveryDeadline = Date.now() + timeoutMs;
        observationDeadline = deliveryDeadline + timing.terminalObservationMs;
        lifetimeTimer = setTimeout(() => controller.abort(), timeoutMs);
    }
    function endLifetime() { if (lifetimeTimer)
        clearTimeout(lifetimeTimer); }
    function canDeliver() {
        if (Date.now() >= deliveryDeadline && !controller.signal.aborted)
            controller.abort();
        return !controller.signal.aborted;
    }
    function assertDelivery() { if (!canDeliver())
        fail("RUN_CANCELLED"); }
    /** Bounded wait with handled late outcome. Observation waits shorten their deadline on abort;
     * delivery waits fail on abort; persistence ignores delivery abort to retain known charges. */
    function wait(promise, deadline, code, mode) {
        return new Promise((resolve, reject) => {
            let finished = false;
            let timer;
            const finish = (value, error) => {
                if (finished)
                    return;
                finished = true;
                if (timer)
                    clearTimeout(timer);
                controller.signal.removeEventListener("abort", aborted);
                if (error !== undefined)
                    reject(error);
                else
                    resolve(value);
            };
            const schedule = () => {
                if (timer)
                    clearTimeout(timer);
                const remaining = deadline() - Date.now();
                if (remaining <= 0) {
                    if (mode === "delivery")
                        controller.abort();
                    finish(undefined, new GatewayDispatchError(code));
                }
                else
                    timer = setTimeout(() => { if (mode === "delivery")
                        controller.abort(); finish(undefined, new GatewayDispatchError(code)); }, remaining);
            };
            const aborted = () => { if (mode === "delivery")
                finish(undefined, new GatewayDispatchError(code));
            else if (mode === "observation")
                schedule(); };
            promise.then((value) => finish(value), (error) => finish(undefined, error));
            if (mode !== "persistence")
                controller.signal.addEventListener("abort", aborted);
            if (mode === "delivery" && controller.signal.aborted)
                aborted();
            else
                schedule();
        });
    }
    async function authority(invoke, hardDeadline = Infinity) {
        assertDelivery();
        const deadline = Math.min(hardDeadline, Number.isFinite(deliveryDeadline) ? deliveryDeadline : Date.now() + resolution.snapshot.limits.timeoutMs);
        const result = await wait(track("authority", invoke), () => deadline, "RUN_CANCELLED", "delivery");
        assertDelivery();
        return result;
    }
    async function observe(kind, invoke) {
        if (Date.now() >= observationDeadline)
            fail("MODEL_INTERRUPTED");
        return await wait(track(kind, invoke), () => observationDeadline, "MODEL_INTERRUPTED", "observation");
    }
    async function cleanup(invoke) {
        try {
            await wait(track("cleanup", invoke), () => Date.now() + timing.cleanupMs, "CLEANUP_PENDING", "persistence");
        }
        catch { /* Exposed pending RPC remains handled; no rollback/termination inference. */ }
    }
    const capture = composition.terminalSink.capture.bind(composition.terminalSink);
    let pendingEvidence;
    let reconciliationPending = false;
    let capturedAcknowledgment;
    let captureFlight;
    async function capturePending(deadline = Date.now() + timing.terminalPersistenceMs) {
        if (!pendingEvidence)
            return false;
        const evidenceCanonical = canonicalModelJson(pendingEvidence);
        if (captureFlight && captureFlight.evidenceCanonical !== evidenceCanonical)
            fail("TERMINAL_EVIDENCE_CONFLICT");
        if (!captureFlight || captureFlight.outcome === "failed") {
            if (Date.now() >= deadline)
                fail("TERMINAL_CAPTURE_PENDING");
            const evidence = pendingEvidence;
            const flight = { evidenceCanonical, outcome: "pending", promise: Promise.resolve({ confirmed: false }) };
            // Both branches are total: hostile late acknowledgments never create an unobserved rejection.
            flight.promise = track("capture", () => capture(detached(evidence))).then((input) => {
                try {
                    const acknowledgment = captureAcknowledgment(input);
                    flight.outcome = "confirmed";
                    capturedAcknowledgment = acknowledgment;
                    if (pendingEvidence === evidence)
                        pendingEvidence = undefined;
                    return { confirmed: true, acknowledgment };
                }
                catch {
                    flight.outcome = "failed";
                    return { confirmed: false };
                }
            }, () => { flight.outcome = "failed"; return { confirmed: false }; });
            captureFlight = flight;
        }
        let outcome;
        try {
            outcome = await wait(captureFlight.promise, () => deadline, "TERMINAL_CAPTURE_PENDING", "persistence");
        }
        catch {
            return fail("TERMINAL_CAPTURE_PENDING");
        }
        if (!outcome.confirmed)
            fail("TERMINAL_CAPTURE_PENDING");
        return true;
    }
    let pendingAttachment;
    let attachmentFlight;
    async function attachPending(deadline = Date.now() + timing.terminalPersistenceMs) {
        if (!pendingAttachment)
            return undefined;
        const tuple = pendingAttachment;
        const canonical = canonicalModelJson(tuple);
        if (attachmentFlight && attachmentFlight.canonical !== canonical)
            fail("TERMINAL_RESULT_WITHHELD");
        if (!attachmentFlight || attachmentFlight.outcome === "failed") {
            if (Date.now() >= deadline) {
                // An unissued tuple cannot become an attachment retry after the output deadline.
                if (!attachmentFlight) {
                    pendingAttachment = undefined;
                    reconciliationPending = false;
                }
                fail("TERMINAL_RECONCILIATION_PENDING");
            }
            const flight = { canonical, outcome: "pending", promise: Promise.resolve({ failed: true, conflict: false }) };
            // Settlement counter now denotes atomic-lane attachment RPCs, not ordinary settlement.
            flight.promise = track("settlement", () => composition.ledger.attachTerminalResult(detached(tuple))).then((input) => {
                try {
                    const acknowledgment = attachmentAcknowledgment(input);
                    flight.outcome = "confirmed";
                    if (pendingAttachment === tuple) {
                        pendingAttachment = undefined;
                        reconciliationPending = false;
                    }
                    return { acknowledgment };
                }
                catch {
                    flight.outcome = "failed";
                    reconciliationPending = true;
                    return { failed: true, conflict: false };
                }
            }, (error) => {
                const conflict = attachmentConflict(error);
                flight.outcome = "failed";
                if (conflict && pendingAttachment === tuple)
                    pendingAttachment = undefined;
                reconciliationPending = !conflict;
                return { failed: true, conflict };
            });
            attachmentFlight = flight;
        }
        let outcome;
        try {
            outcome = await wait(attachmentFlight.promise, () => deadline, "TERMINAL_RECONCILIATION_PENDING", "persistence");
        }
        catch {
            reconciliationPending = pendingAttachment !== undefined;
            return fail("TERMINAL_RECONCILIATION_PENDING");
        }
        if ("failed" in outcome)
            fail(outcome.conflict ? "TERMINAL_RESULT_WITHHELD" : "TERMINAL_RECONCILIATION_PENDING");
        return outcome.acknowledgment;
    }
    const lifecycle = { signal: controller.signal, pendingWork: () => {
            const counts = { authority: 0, capture: 0, settlement: 0, native: 0, reader: 0, cleanup: 0 };
            pendingRPCs.forEach((slot) => { counts[slot.kind]++; });
            return Object.freeze(counts);
        }, cancel: () => controller.abort(), complete: async () => { let joined = 0; while (joined < tasks.length) {
            const batch = tasks.slice(joined);
            joined = tasks.length;
            await Promise.all(batch);
        } if (pendingEvidence)
            fail("TERMINAL_CAPTURE_PENDING"); if (reconciliationPending)
            fail("TERMINAL_RECONCILIATION_PENDING"); },
        retryPendingTerminalEvidence: () => own(() => capturePending()), retryPendingTerminalAttachment: () => own(() => attachPending()), consumeReplay: () => own(async () => {
            if (!replay)
                return undefined;
            assertDelivery();
            proofFor(checkedResolution(await authority(() => composition.ledger.resolve(resolveArgs(binding)))), (composition.now ?? Date.now)());
            const result = providerJSON(exactJSON(replay, resolution.storageLimits.privateResultBytes));
            if (!result)
                fail("INVALID_REPLAY");
            if (resolution.snapshot.nativeInterface === "chat") {
                const item = record(result, ["text"]);
                if (typeof item.text !== "string" || !item.text)
                    fail("INVALID_REPLAY");
                utf8(item.text);
                assertDelivery();
                return { text: item.text };
            }
            const item = record(result, ["profile", "vectors"]);
            assertProfileMatches(item.profile);
            if (!Array.isArray(item.vectors) || item.vectors.length !== 1)
                fail("INVALID_REPLAY");
            item.vectors.forEach((v) => assertEmbeddingVector(v));
            assertDelivery();
            return { profile: DEFAULT_EMBEDDING_PROFILE, vectors: item.vectors };
        }) };
    async function admit(request) {
        proofFor(resolution, (composition.now ?? Date.now)());
        assertDelivery();
        const incoming = json(request, resolution.storageLimits.canonicalBytes);
        const admitted = checkedAdmission(await authority(() => composition.ledger.admit({ ...binding, requestCanonical: incoming })));
        if (admitted.status !== "reserved") {
            if (admitted.status === "replay")
                replay = admitted.resultCanonical;
            fail(admitted.status === "replay" ? "REPLAY_AVAILABLE" : "UNCERTAIN_OR_INFLIGHT");
        }
        const flat = exactJSON(admitted.requestCanonical, resolution.storageLimits.canonicalBytes);
        const validated = validateModelRequest(admitted.snapshot, flat).request;
        const comparable = { ...validated, semanticId: request.semanticId, childCallId: request.childCallId };
        if (canonicalModelJson(comparable) !== canonicalModelJson(request) || canonicalModelJson(admitted.snapshot) !== canonicalModelJson(resolution.snapshot))
            fail("ADMITTED_REQUEST_MISMATCH");
        const permit = checkedPermit(await authority(() => composition.ledger.checkpoint({ reference: binding.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical })));
        if (!permit.dispatchPermit)
            fail("DISPATCH_NOT_PERMITTED");
        if (permit.requestCanonical !== admitted.requestCanonical || canonicalModelJson(permit.snapshot) !== canonicalModelJson(admitted.snapshot))
            fail("CHECKPOINT_MISMATCH");
        assertDelivery();
        return { ...admitted, dispatchIdentity: permit.dispatchIdentity };
    }
    const visible = async (attempt, outputVisible = false, hardDeadline = Infinity) => {
        assertDelivery();
        const acknowledgment = record(await authority(() => composition.ledger.markVisible({ reference: binding.reference, attemptId: attempt.attemptId, outputVisible, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false }), hardDeadline), ["recorded"]);
        if (Object.keys(acknowledgment).length !== 1 || acknowledgment.recorded !== true)
            fail("DELIVERY_AUTHORITY_REVOKED");
        assertDelivery();
    };
    async function terminal(attempt, raw, privateResult) {
        const deadline = Date.now() + timing.terminalPersistenceMs;
        const id = raw.id;
        const actual = raw.model;
        const usage = providerJSON(raw.usage);
        if (typeof id !== "string" || !id || id.length > 256 || typeof actual !== "string" || !actual || actual.length > 256)
            fail("UNQUALIFIED_TERMINAL");
        utf8(id);
        utf8(actual);
        const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, resolution.storageLimits.canonicalBytes)).request;
        const observed = usage ? usageOf(usage) : {};
        const nativeBoundViolation = actual !== qualifiedTerminalModelId(resolution.dispatchEvidence)
            || (observed.inputTokens !== undefined && observed.inputTokens > admitted.inputTokens)
            || (observed.outputTokens !== undefined && observed.outputTokens > admitted.outputTokens);
        if (nativeBoundViolation || !canDeliver())
            privateResult = undefined;
        const cost = resolution.dispatchEvidence.terminalCost === "gateway-aggregate-usd-v1" && usage ? conservativeUsdDecimal(usage.cost) : undefined;
        const receipt = { version: 1, dispatchIdentity: attempt.dispatchIdentity, receiptId: id, modelId: resolution.snapshot.modelId, nativeInterface: resolution.snapshot.nativeInterface,
            outcome: "confirmed", proof: "provider-terminal-v1", costSource: cost === undefined ? "unavailable" : "gateway-aggregate-usd-v1",
            ...(cost !== undefined ? { aggregateCostUsd: cost } : {}), ...(usage ? { usage: usageOf(usage) } : {}), actualModel: actual };
        const receiptCanonical = json(receipt, resolution.storageLimits.canonicalBytes);
        pendingEvidence = { attemptId: attempt.attemptId, dispatchIdentity: attempt.dispatchIdentity, receiptCanonical };
        await capturePending(deadline);
        const ack = capturedAcknowledgment;
        if (nativeBoundViolation || ("overrun" in ack && ack.overrun))
            fail("QUALIFICATION_OVERRUN");
        if (!canDeliver())
            assertDelivery();
        // A complete matching result may be retained while its FULL qualified ceiling
        // stays uncertain. Native attachment independently validates the same proof,
        // usage, current grant/source and payload; it never settles or refunds money.
        const confirmedUnknown = resolution.dispatchEvidence.terminalCost === "unavailable"
            && observed.inputTokens !== undefined && (resolution.snapshot.nativeInterface === "embedding" || observed.outputTokens !== undefined);
        if (!privateResult || ("state" in ack && ack.state !== "settled" && !(ack.state === "uncertain" && confirmedUnknown)))
            fail("TERMINAL_RESULT_WITHHELD");
        // Retain private bytes only when attachment is actually issued within the ORIGINAL deadline.
        if (Date.now() >= deadline)
            fail("TERMINAL_RECONCILIATION_PENDING");
        pendingAttachment = detached({ reference: binding.reference, attemptId: attempt.attemptId, evidenceId: ack.evidenceId, privateResultCanonical: privateResult });
        reconciliationPending = true;
        const attached = await attachPending(deadline);
        if (!attached || !attached.attached || attached.resultWithheld)
            fail("TERMINAL_RESULT_WITHHELD");
        assertDelivery();
    }
    return { binding, resolution, controller, lifecycle, tasks, admit, visible, terminal, startLifetime, endLifetime, assertDelivery, canDeliver, observe, cleanup, own };
}
/** Native test seams accept ONLY the official Gateway provider identity, never alternate routing.
 * Production callers use createGovernedGatewayModel; injected-fetch models are offline fixtures. */
export function governGatewayLanguageModel(model, composition, binding, resolution) {
    const state = stateFor(composition, binding, resolution);
    if (resolution.snapshot.nativeInterface !== "chat" || model.modelId !== resolution.snapshot.modelId || model.provider !== "convexGateway.chat")
        fail("MODEL_IDENTITY_MISMATCH");
    const input = new WeakMap();
    const wrapped = wrapLanguageModel({ model, middleware: { specificationVersion: "v4",
            transformParams: async ({ params, type }) => {
                const normalized = languageParams(params, state.resolution.snapshot, state.resolution.dispatchEvidence, state.binding, state.controller.signal);
                if (type === "stream")
                    normalized.params.includeRawChunks = true;
                input.set(normalized.params, normalized.request);
                return normalized.params;
            },
            wrapGenerate: ({ params, doGenerate }) => state.own(async () => {
                const request = input.get(params);
                const attempt = await state.admit(request);
                const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
                if (nativeIdentity(params) !== nativeIdentity(nativeLanguage(admitted, state.controller.signal)))
                    fail("ADMITTED_REQUEST_MISMATCH");
                let result;
                state.startLifetime(request.timeoutMs);
                try {
                    result = await state.observe("native", doGenerate);
                }
                catch {
                    state.endLifetime();
                    return fail("MODEL_INTERRUPTED");
                }
                try {
                    const raw = providerJSON(result.response?.body);
                    const choices = raw?.choices;
                    if (!raw || !Array.isArray(choices) || choices.length !== 1 || !terminalReasons.includes(choices[0].finish_reason ?? ""))
                        fail("UNQUALIFIED_TERMINAL");
                    let text = "";
                    let supported = false;
                    let privateResult;
                    try {
                        const content = detached(result.content);
                        text = content.filter((part) => part.type === "text").map((part) => part.text).join("");
                        supported = content.every((part) => ["text", "reasoning"].includes(part.type));
                        if (text && supported)
                            privateResult = json({ text }, Math.min(state.resolution.storageLimits.privateResultBytes, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes));
                    }
                    catch { /* Capture observed charge even when output violated its bound. */ }
                    try {
                        await state.terminal(attempt, raw, state.canDeliver() ? privateResult : undefined);
                    }
                    finally {
                        state.endLifetime();
                    }
                    state.assertDelivery();
                    if (!privateResult || state.controller.signal.aborted)
                        fail("RESULT_BOUND_EXCEEDED");
                    if (!text || !supported)
                        fail("UNSUPPORTED_MODEL_OUTPUT");
                    return { content: [{ type: "text", text }], finishReason: { unified: choices[0].finish_reason === "length" ? "length" : choices[0].finish_reason === "content_filter" ? "content-filter" : "stop", raw: choices[0].finish_reason }, usage: nativeUsage(providerJSON(raw.usage)), warnings: [] };
                }
                finally {
                    state.endLifetime();
                }
            }),
            wrapStream: ({ params, doStream }) => state.own(async () => {
                const attempt = await state.admit(input.get(params));
                const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
                if (nativeIdentity(params) !== nativeIdentity(nativeLanguage(admitted, state.controller.signal)))
                    fail("ADMITTED_REQUEST_MISMATCH");
                let result;
                state.startLifetime(input.get(params).timeoutMs);
                try {
                    result = await state.observe("native", doStream);
                }
                catch {
                    state.endLifetime();
                    return fail("MODEL_INTERRUPTED");
                }
                const reader = result.stream.getReader();
                let observer;
                let observerClosed = false;
                const output = new ReadableStream({ start(c) { observer = c; }, cancel() { observerClosed = true; } }, { highWaterMark: 64 });
                let text = "";
                let deliveryError;
                let terminalReason;
                let rawTerminal;
                let id;
                let actualModel;
                let textStarted = false;
                let terminalAttempted = false;
                const drain = async () => {
                    const interrupted = () => { deliveryError ??= new GatewayDispatchError("STREAM_INTERRUPTED"); if (!observerClosed) {
                        observerClosed = true;
                        observer.error(deliveryError);
                    } };
                    const emit = (part) => {
                        // EVERY enqueue is fenced, including start/end/finish, independently of provider abort.
                        if (!state.canDeliver()) {
                            interrupted();
                            return;
                        }
                        if (observerClosed || deliveryError)
                            return;
                        if ((observer.desiredSize ?? 0) <= 0) {
                            observerClosed = true;
                            observer.error(new GatewayDispatchError("OBSERVER_BUFFER_LIMIT"));
                            return;
                        }
                        state.assertDelivery();
                        observer.enqueue(part);
                    };
                    state.controller.signal.addEventListener("abort", interrupted);
                    if (state.controller.signal.aborted)
                        interrupted();
                    try {
                        while (true) {
                            const item = await state.observe("reader", () => reader.read());
                            if (item.done)
                                break;
                            const part = item.value;
                            if (part.type === "raw") {
                                const raw = providerJSON(part.rawValue);
                                if (!raw || "error" in raw)
                                    continue;
                                if (typeof raw.id === "string") {
                                    if (id && id !== raw.id)
                                        fail("UNQUALIFIED_TERMINAL");
                                    id = raw.id;
                                }
                                if (typeof raw.model === "string") {
                                    if (actualModel && actualModel !== raw.model)
                                        fail("UNQUALIFIED_TERMINAL");
                                    actualModel = raw.model;
                                    if (actualModel !== state.resolution.snapshot.modelId && !deliveryError) {
                                        deliveryError = new GatewayDispatchError("QUALIFICATION_OVERRUN");
                                        if (!observerClosed) {
                                            observerClosed = true;
                                            observer.error(deliveryError);
                                        }
                                    }
                                }
                                const choices = raw.choices;
                                if (Array.isArray(choices) && choices.length === 1 && terminalReasons.includes(choices[0].finish_reason ?? ""))
                                    terminalReason = choices[0].finish_reason;
                                if (terminalReason || providerJSON(raw.usage))
                                    rawTerminal = { id, model: actualModel, ...(rawTerminal?.usage ? { usage: rawTerminal.usage } : {}), ...(providerJSON(raw.usage) ? { usage: raw.usage } : {}) };
                                continue;
                            }
                            if (part.type === "error")
                                fail("STREAM_INTERRUPTED");
                            if (part.type === "text-delta") {
                                if (!deliveryError) {
                                    text += part.delta;
                                    if (utf8(text) > state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes / 6) {
                                        deliveryError = new GatewayDispatchError("RESULT_BOUND_EXCEEDED");
                                        text = "";
                                        if (!observerClosed) {
                                            observerClosed = true;
                                            observer.error(deliveryError);
                                        }
                                    }
                                }
                                if (!deliveryError) {
                                    try {
                                        await state.visible(attempt, !observerClosed);
                                    }
                                    catch {
                                        deliveryError ??= new GatewayDispatchError(state.controller.signal.aborted ? "STREAM_INTERRUPTED" : "DELIVERY_AUTHORITY_REVOKED");
                                        if (!observerClosed) {
                                            observerClosed = true;
                                            observer.error(deliveryError);
                                        }
                                    }
                                }
                                if (!state.canDeliver())
                                    interrupted();
                                if (!observerClosed && !deliveryError) {
                                    if (!textStarted) {
                                        emit({ type: "text-start", id: "governed-text" });
                                        textStarted = true;
                                    }
                                    emit({ type: "text-delta", id: "governed-text", delta: part.delta });
                                }
                            }
                            else if (part.type === "finish") { /* Native EOF flush is NOT terminal proof. */ }
                            else if (!["reasoning-start", "reasoning-delta", "reasoning-end", "text-start", "text-end", "response-metadata", "stream-start"].includes(part.type)) {
                                deliveryError = new GatewayDispatchError("UNSUPPORTED_MODEL_OUTPUT");
                                if (!observerClosed) {
                                    observerClosed = true;
                                    observer.error(deliveryError);
                                }
                            }
                        }
                        if (!terminalReason || !rawTerminal)
                            fail("UNQUALIFIED_TERMINAL");
                        terminalAttempted = true;
                        await state.terminal(attempt, rawTerminal, text && !deliveryError && !state.controller.signal.aborted ? json({ text }, Math.min(state.resolution.storageLimits.privateResultBytes, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes)) : undefined);
                        if (deliveryError)
                            throw deliveryError;
                        if (!state.canDeliver())
                            interrupted();
                        if (!observerClosed && !deliveryError) {
                            if (textStarted)
                                emit({ type: "text-end", id: "governed-text" });
                            emit({ type: "finish", finishReason: { unified: terminalReason === "length" ? "length" : terminalReason === "content_filter" ? "content-filter" : "stop", raw: terminalReason }, usage: nativeUsage(providerJSON(rawTerminal.usage)) });
                            if (!observerClosed) {
                                state.assertDelivery();
                                observer.close();
                                observerClosed = true;
                            }
                        }
                    }
                    catch (error) {
                        // Real terminal evidence may already be complete despite a later observer/authority failure.
                        if (!terminalAttempted && terminalReason && rawTerminal) {
                            try {
                                await state.terminal(attempt, rawTerminal);
                            }
                            catch (terminalError) {
                                error = terminalError;
                            }
                        }
                        if (!observerClosed) {
                            observerClosed = true;
                            observer.error(error instanceof GatewayDispatchError ? error : new GatewayDispatchError("STREAM_INTERRUPTED"));
                        }
                        throw error instanceof GatewayDispatchError ? error : new GatewayDispatchError("STREAM_INTERRUPTED");
                    }
                    finally {
                        state.endLifetime();
                        state.controller.signal.removeEventListener("abort", interrupted);
                        await state.cleanup(() => reader.cancel());
                        reader.releaseLock();
                    }
                };
                // Explicitly retained/joined task; never an unbounded tee. Attach rejection handler immediately
                // so delayed owner complete() cannot create an unhandled rejection; complete still rejects.
                const task = drain();
                task.catch(() => undefined);
                state.tasks.push(task);
                return { stream: output };
            }),
        } });
    return { model: wrapped, lifecycle: state.lifecycle };
}
export function governGatewayEmbeddingModel(model, composition, binding, resolution) {
    const state = stateFor(composition, binding, resolution);
    if (resolution.snapshot.nativeInterface !== "embedding" || model.modelId !== DEFAULT_EMBEDDING_PROFILE.modelId || model.provider !== "convexGateway.embedding")
        fail("MODEL_IDENTITY_MISMATCH");
    const requests = new WeakMap();
    const wrapped = wrapEmbeddingModel({ model, middleware: { specificationVersion: "v4", overrideMaxEmbeddingsPerCall: () => 1,
            transformParams: async ({ params }) => {
                const n = record(params, ["values", "headers", "providerOptions", "abortSignal"]);
                if (n.headers !== undefined || n.providerOptions !== undefined || (n.abortSignal !== undefined && n.abortSignal !== state.controller.signal))
                    fail("UNSUPPORTED_NATIVE_FIELD");
                const values = arrayValues(n.values);
                if (values.length !== 1 || typeof values[0] !== "string")
                    fail("EMBEDDING_VALUE_BOUND");
                const text = values[0];
                utf8(text);
                const normalized = normalizeSourceText(text);
                const bytes = utf8(normalized);
                if (bytes > 8192)
                    fail("INPUT_BOUND_EXCEEDED");
                const request = requestBase(state.resolution.snapshot, state.binding);
                request.texts = [normalized];
                request.inputTokens = bytes;
                request.profile = DEFAULT_EMBEDDING_PROFILE;
                request.batch = { ordinal: state.binding.ordinal, start: state.binding.ordinal, end: state.binding.ordinal + 1 };
                const checked = validateModelRequest(state.resolution.snapshot, request).request;
                const transformed = { values: [...checked.texts], abortSignal: state.controller.signal };
                requests.set(transformed, detached(checked));
                return transformed;
            },
            wrapEmbed: ({ params, doEmbed }) => state.own(async () => {
                const request = requests.get(params);
                const attempt = await state.admit(request);
                const admitted = validateModelRequest(attempt.snapshot, exactJSON(attempt.requestCanonical, state.resolution.storageLimits.canonicalBytes)).request;
                if (canonicalModelJson(params.values) !== canonicalModelJson(admitted.texts))
                    fail("ADMITTED_REQUEST_MISMATCH");
                let result;
                state.startLifetime(request.timeoutMs);
                try {
                    result = await state.observe("native", doEmbed);
                }
                catch {
                    state.endLifetime();
                    return fail("MODEL_INTERRUPTED");
                }
                try {
                    const raw = providerJSON(result.response?.body);
                    if (!raw || !Array.isArray(raw.data) || raw.data.length !== 1 || result.embeddings.length !== 1)
                        fail("UNQUALIFIED_TERMINAL");
                    let payload;
                    try {
                        const vectors = detached(result.embeddings);
                        assertEmbeddingVector(vectors[0]);
                        payload = json({ profile: DEFAULT_EMBEDDING_PROFILE, vectors }, Math.min(state.resolution.storageLimits.privateResultBytes, state.resolution.dispatchEvidence.resultBound.maximumPrivateResultBytes));
                    }
                    catch { /* Invalid output never discards terminal charge. */ }
                    try {
                        await state.terminal(attempt, raw, state.canDeliver() ? payload : undefined);
                    }
                    finally {
                        state.endLifetime();
                    }
                    state.assertDelivery();
                    if (!payload || state.controller.signal.aborted)
                        fail("UNSUPPORTED_MODEL_OUTPUT");
                    const usage = providerJSON(raw.usage);
                    const tokens = usage && count(usage.prompt_tokens) ? usage.prompt_tokens : undefined;
                    const safe = { embeddings: detached(result.embeddings), warnings: [], ...(tokens !== undefined ? { usage: { tokens } } : {}) };
                    state.assertDelivery();
                    return safe;
                }
                finally {
                    state.endLifetime();
                }
            }),
        } });
    return { model: wrapped, lifecycle: state.lifecycle };
}
