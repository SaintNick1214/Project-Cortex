/** Credential-free native peers and official injected-fetch transform fixtures only.
 * Synthetic qualifications never enter the production bootstrap registry. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4GenerateResult, LanguageModelV4StreamPart, EmbeddingModelV4 } from "@ai-sdk/provider";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createOpenAI } from "@ai-sdk/openai";
import type { GatewayBinding, GatewayComposition, GatewayLedgerPort, GatewayResolution } from "../../../convex-dev/runtimeGateway";
import { canonicalModelJson, resolveModelPolicy, validateModelRequest } from "../../../src/domain/model-policy";
import type { ModelCallRequest } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE } from "../../../src/domain/profile";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";
const server = await import("convex/server");
const tokenLookup = jest.fn<() => Promise<string>>().mockRejectedValue(new Error("OFFLINE_TOKEN_PROHIBITED"));
jest.unstable_mockModule("convex/server", () => ({ ...server, getServiceToken: tokenLookup }));
const { conservativeUsdDecimal, createGovernedGatewayModel, governGatewayLanguageModel, governGatewayEmbeddingModel } = await import("../../../convex-dev/runtimeGateway");
const hash = "a".repeat(64);
const reference = { tenantId: "t", tenantEpoch: 1, memorySpaceId: "s", memorySpaceEpoch: 1, principalId: "p", principalVersion: 1, membershipId: "m", membershipVersion: 1, grantId: "g", grantVersion: 1 } as RuntimeAuthorityReference;
const binding: GatewayBinding = { reference, operationKey: "agent.respond", runBudgetId: "budget", semanticId: "stable-semantic", ordinal: 0 };
const pins = { promptVersion: "p1", schemaVersion: "s1", extractionVersion: "e1", toolRegistryVersion: "t1", priceRevision: "price1", boundRevision: "bound1" };
function resolution(embedding = false): GatewayResolution {
  const modelId = embedding ? DEFAULT_EMBEDDING_PROFILE.modelId : "openai/gpt-4o-mini";
  const nativeInterface = embedding ? "embedding" as const : "chat" as const;
  const limits = { inputTokens: 10000, contextTokens: 11000, outputTokens: 64, toolSteps: 4, timeoutMs: 1000, operationBudgetUnits: 100000, runBudgetUnits: 1000000, tenantBudgetUnits: 1000000, concurrency: 3 };
  const q = { receiptId: "fixture", modelId, nativeInterface, capabilities: embedding ? ["embedding" as const] : ["text" as const], allowedOptions: ["temperature" as const, "seed" as const], limits,
    costBound: { kind: "qualified-call-ceiling" as const, maximumCostUnits: 10000, provenance: "SYNTHETIC-OFFLINE-ONLY", coversAllProviderCharges: true as const }, priceRevision: "price1", boundRevision: "bound1" };
  const snapshot = resolveModelPolicy({ context: { scope: reference, operationKey: embedding ? "embedding.query" : "agent.respond", runBudgetId: "budget", authorizedOverrides: [], ...(embedding ? { semanticProfile: DEFAULT_EMBEDDING_PROFILE } : {}) },
    policies: [{ policyId: "d", version: 1, scope: "deployment", rules: { modelId, nativeInterface, allowedModels: [modelId], interfaces: [nativeInterface], capabilities: q.capabilities, allowedOptions: q.allowedOptions, allowedTools: [], fallbackModels: [], limits, pins } }], qualifications: [q] });
  return { snapshot, storageLimits: { canonicalBytes: 180000, privateResultBytes: 60000, embeddingValuesPerCall: 1 }, dispatchEvidence: {
    receiptId: "fixture", modelId, nativeInterface, evidenceHash: hash, providerVersion: "0.2.1", priceRevision: "price1", boundRevision: "bound1", checkedAt: 0, expiresAt: 100000,
    terminalCost: "gateway-aggregate-usd-v1", terminalProof: "provider-terminal-v1",
    inputBound: { ruleId: embedding ? "default-embedding-utf8-v1" : "plain-chat-cookbook-utf8-v1", featureEnvelope: embedding ? "default-embedding-v1" : "plain-chat-v1", revision: 1, proofHash: hash, documentHash: hash, nativeTransformHash: hash },
    resultBound: { maximumPrivateResultBytes: 60000, maximumOutputTokens: 64, maximumEmbeddingValues: 1, proofHash: hash } } };
}
const params = (): LanguageModelV4CallOptions => ({ prompt: [{ role: "user", content: [{ type: "text", text: " hello\r\n " }] }], maxOutputTokens: 16 });
function raw(text = "answer", cost: unknown = "0.0005") { return { id: "convex-receipt", model: "openai/gpt-4o-mini", choices: [{ finish_reason: "stop", message: { content: text } }], usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10, cost } }; }
function generated(text = "answer", body = raw(text)): LanguageModelV4GenerateResult {
  return { content: [{ type: "text", text }, { type: "reasoning", text: "SECRET_REASONING" }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: 0 } }, response: { body }, warnings: [] };
}
function fixture(embedding = false) {
  const r = resolution(embedding); const b = { ...binding, operationKey: embedding ? "embedding.query" as const : "agent.respond" as const };
  const events: string[] = []; const receipts: string[] = []; const admissions: (GatewayBinding & { requestCanonical: string })[] = []; let disposition: "reserved" | "uncertain" | "inflight" | "replay" = "reserved";
  const nativeCalls: LanguageModelV4CallOptions[] = []; let nativeCount = 0; let revoked = false; let captureFails = false; let changedPermit = false; let changedAdmit = false; let ledgerSettled = false;
  const ledger: GatewayLedgerPort = {
    resolve: async () => { events.push("resolve"); if (revoked) throw new Error("revoked"); return r; },
    admit: async (args) => {
      events.push("admit"); admissions.push(args);
      if (disposition !== "reserved") return disposition === "replay" ? { status: "replay", operationId: "op" as Id<"runtimeModelOperations">, resultCanonical: canonicalModelJson({ text: "saved" }) }
        : { status: disposition, operationId: "op" as Id<"runtimeModelOperations">, attemptId: "attempt" as Id<"runtimeModelAttempts"> };
      const input = JSON.parse(args.requestCanonical) as ModelCallRequest;
      const request = { ...input, childCallId: "server-child", ...(changedAdmit ? { texts: ["tampered"], messages: [{ role: "user" as const, parts: [{ type: "text" as const, text: "tampered" }] }] } : {}) };
      validateModelRequest(r.snapshot, request);
      return { status: "reserved", operationId: "op" as Id<"runtimeModelOperations">, attemptId: "attempt" as Id<"runtimeModelAttempts">, snapshot: r.snapshot, requestCanonical: canonicalModelJson(request) };
    },
    checkpoint: async (args) => { events.push("checkpoint"); disposition = "uncertain"; return { dispatchPermit: true, dispatchIdentity: "dispatch", snapshot: r.snapshot, requestCanonical: changedPermit ? "{}" : args.requestCanonical }; },
    markVisible: async (args) => { events.push(args.outputVisible ? "visible" : "current"); if (ledgerSettled) throw new Error("B visibility requires pending state"); if (revoked) throw new Error("revoked"); return { recorded: true }; },
    settle: async (args) => { events.push("settle"); if (revoked) throw new Error("revoked"); const receipt = JSON.parse(args.receiptCanonical) as { costSource: string; privateResultCanonical?: string };
      ledgerSettled = receipt.costSource !== "unavailable"; return { state: receipt.costSource === "unavailable" ? "uncertain" : "settled", resultWithheld: !receipt.privateResultCanonical }; },
  };
  const composition: GatewayComposition = { ledger, now: () => 1000, terminalSink: { capture: async (e) => { events.push("capture"); if (captureFails) throw new Error("sink unavailable"); receipts.push(e.receiptCanonical); return { evidenceId: "durable-evidence" }; } } };
  const model: LanguageModelV4 = { specificationVersion: "v4", modelId: r.snapshot.modelId, provider: "convexGateway.chat", supportedUrls: {},
    doGenerate: async (input) => { events.push("native"); nativeCount++; nativeCalls.push(input); return generated(); },
    doStream: async (input) => { events.push("native"); nativeCount++; nativeCalls.push(input); return { stream: streamParts() }; } };
  function streamParts(parts?: LanguageModelV4StreamPart[]) { const items: LanguageModelV4StreamPart[] = parts ?? [
    { type: "reasoning-delta", id: "r", delta: "SECRET_REASONING" }, { type: "text-delta", id: "t", delta: "answer" },
    { type: "raw", rawValue: { id: "convex-receipt", model: r.snapshot.modelId, choices: [{ finish_reason: "stop" }] } },
    { type: "raw", rawValue: { id: "convex-receipt", model: r.snapshot.modelId, choices: [], usage: raw().usage } },
    { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: generated().usage } ];
    return new ReadableStream<LanguageModelV4StreamPart>({ start(c) { items.forEach((x) => c.enqueue(x)); c.close(); } });
  }
  return { r, b, events, receipts, admissions, nativeCalls, model, composition, streamParts, count: () => nativeCount,
    disposition: (x: typeof disposition) => { disposition = x; }, revoke: () => { revoked = true; }, captureFail: () => { captureFails = true; }, captureResume: () => { captureFails = false; }, changedPermit: () => { changedPermit = true; }, changedAdmit: () => { changedAdmit = true; } };
}
beforeEach(() => { tokenLookup.mockClear(); });

describe("bounded governed Gateway middleware", () => {
  it("requires a durable server sink before model construction/resolution", async () => {
    const f = fixture(); const composition = { ...f.composition, terminalSink: undefined } as unknown as GatewayComposition;
    await expect(createGovernedGatewayModel(composition, f.b)).rejects.toMatchObject({ code: "DURABLE_TERMINAL_SINK_REQUIRED" }); expect(f.events).toEqual([]); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("denies actual official Gateway quota before private token lookup", async () => {
    const f = fixture(); f.composition.ledger.admit = async () => { throw new Error("quota"); };
    const h = await createGovernedGatewayModel(f.composition, f.b);
    await expect((h.model as LanguageModelV4).doGenerate(params())).rejects.toThrow("quota"); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("dispatches detached normalized values after exact admission+checkpoint; sanitizes reasoning", async () => {
    const f = fixture(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const original = params();
    const admitted = f.composition.ledger.admit; f.composition.ledger.admit = async (args) => { (original.prompt[0]!.content as { text: string }[])[0]!.text = "MUTATED"; return admitted(args); };
    const result = await h.model.doGenerate(original); expect(f.events).toEqual(["admit", "checkpoint", "native", "capture", "visible", "settle"]);
    expect(f.nativeCalls[0]!.prompt).toEqual([{ role: "user", content: [{ type: "text", text: "hello" }] }]); expect(result.content).toEqual([{ type: "text", text: "answer" }]);
    expect(JSON.stringify(result)).not.toContain("SECRET_REASONING"); expect(JSON.parse(f.admissions[0]!.requestCanonical)).toMatchObject({ semanticId: "stable-semantic", inputTokens: 15, outputTokens: 16, reservationUnits: 10000, options: { maxRetries: 0 } }); expect(f.receipts[0]).not.toContain("SECRET_REASONING"); expect(JSON.parse(f.receipts[0]!).aggregateCostUsd).toBe("0.0005");
    expect(JSON.parse(f.receipts[0]!)).not.toHaveProperty("privateResultCanonical"); await h.lifecycle.complete();
  });
  it.each(["uncertain", "inflight", "replay"] as const)("%s disposition makes zero native/token calls", async (status) => {
    const f = fixture(); f.disposition(status); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: status === "replay" ? "REPLAY_AVAILABLE" : "UNCERTAIN_OR_INFLIGHT" }); expect(f.count()).toBe(0); expect(tokenLookup).not.toHaveBeenCalled();
    expect(await h.lifecycle.consumeReplay()).toEqual(status === "replay" ? { text: "saved" } : undefined);
  });
  it("same wrapper invocation after ambiguous first failure cannot create a fresh ordinal/permit", async () => {
    const f = fixture(); f.model.doGenerate = async () => { f.events.push("native"); throw new Error("lost response"); }; const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "MODEL_INTERRUPTED" }); await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "UNCERTAIN_OR_INFLIGHT" });
    expect(f.admissions.map((a) => a.ordinal)).toEqual([0, 0]); expect(f.admissions[0]!.requestCanonical).toBe(f.admissions[1]!.requestCanonical); expect(f.events.filter((x) => x === "native")).toHaveLength(1); expect(f.events.filter((x) => x === "checkpoint")).toHaveLength(1); expect(f.receipts).toEqual([]);
  });
  it.each(["admit", "checkpoint"])("%s tampering denies the native closure", async (phase) => {
    const f = fixture(); if (phase === "admit") f.changedAdmit(); else f.changedPermit(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: phase === "admit" ? "ADMITTED_REQUEST_MISMATCH" : "CHECKPOINT_MISMATCH" }); expect(f.count()).toBe(0);
  });
  it.each(["headers", "providerOptions", "tools", "toolChoice", "reasoning", "topK", "presencePenalty", "frequencyPenalty", "includeRawChunks"])("denies defined %s", async (key) => {
    const f = fixture(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const input = Object.assign(params(), { [key]: key === "headers" ? { Authorization: "fake" } : {} });
    await expect(h.model.doGenerate(input)).rejects.toMatchObject({ code: "UNSUPPORTED_NATIVE_FIELD" }); expect(f.events).toEqual([]); expect(f.count()).toBe(0);
  });
  it.each(["getter", "symbol", "nonenumerable", "sparse", "iterator", "surrogate", "partOptions", "schema", "multipart"])("descriptor/native %s denial has no side effects", async (kind) => {
    const f = fixture(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const input = params(); let calls = 0;
    if (kind === "getter") Object.defineProperty(input, "temperature", { enumerable: true, get() { calls++; return 1; } });
    if (kind === "symbol") Object.defineProperty(input, Symbol("x"), { enumerable: true, value: 1 });
    if (kind === "nonenumerable") Object.defineProperty(input, "temperature", { enumerable: false, value: 1 });
    if (kind === "sparse") delete input.prompt[0];
    if (kind === "iterator") Object.defineProperty(input.prompt, Symbol.iterator, { value: () => { calls++; return [][Symbol.iterator](); } });
    if (kind === "surrogate") (input.prompt[0]!.content as { text: string }[])[0]!.text = "\ud800";
    if (kind === "partOptions") Object.assign((input.prompt[0]!.content as object[])[0]!, { providerOptions: { openai: { user: "x" } } });
    if (kind === "schema") input.responseFormat = { type: "json", schema: { type: "object" } };
    if (kind === "multipart") (input.prompt[0]!.content as { type: "text"; text: string }[]).push({ type: "text", text: "second" });
    await expect(h.model.doGenerate(input)).rejects.toBeInstanceOf(Error); expect(calls).toBe(0); expect(f.events).toEqual([]); expect(f.count()).toBe(0);
  });
  it("accepts SDK optional undefined fields but denies unknown own __proto__ before projection", async () => {
    const f = fixture(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const input = params(); Object.assign(input, { headers: undefined, tools: undefined, temperature: undefined });
    await h.model.doGenerate(input); expect(f.count()).toBe(1);
    const other = fixture(); const o = governGatewayLanguageModel(other.model, other.composition, other.b, other.r);
    const hostile = params(); Object.defineProperty(hostile, "__proto__", { value: { hidden: true }, enumerable: true });
    await expect(o.model.doGenerate(hostile)).rejects.toBeInstanceOf(Error); expect(other.count()).toBe(0);
  });
  it("supports allowed scalar settings while rejecting output/context bounds", async () => {
    const f = fixture(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r);
    await h.model.doGenerate({ ...params(), temperature: 0.2, seed: 3 }); expect(f.nativeCalls[0]).toMatchObject({ temperature: 0.2, seed: 3 });
    const n = fixture(); const nh = governGatewayLanguageModel(n.model, n.composition, n.b, n.r); await expect(nh.model.doGenerate({ ...params(), maxOutputTokens: 65 })).rejects.toMatchObject({ code: "OUTPUT_BOUND_EXCEEDED" }); expect(n.count()).toBe(0);
  });
  it("unsupported Responses evidence, wrong profile, expired proof and alternate provider deny before closure", () => {
    const f = fixture(); const responses = structuredClone(f.r); (responses.snapshot as unknown as { nativeInterface: string }).nativeInterface = "responses";
    expect(() => governGatewayLanguageModel(f.model, f.composition, f.b, responses)).toThrow();
    const stale = structuredClone(f.r); stale.dispatchEvidence = { ...stale.dispatchEvidence, expiresAt: 1 }; expect(() => governGatewayLanguageModel(f.model, f.composition, f.b, stale)).toThrow();
    expect(() => governGatewayLanguageModel({ ...f.model, provider: "openai.responses" }, f.composition, f.b, f.r)).toThrow(); expect(f.events).toEqual([]);
  });
  it("captures known charge durably before revocation denies ordinary settle", async () => {
    const f = fixture(); const capture = f.composition.terminalSink.capture; f.composition.terminalSink.capture = async (e) => { const result = await capture(e); f.revoke(); return result; };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "TERMINAL_RECONCILIATION_PENDING" }); expect(f.receipts).toHaveLength(1); expect(f.events).toEqual(["admit", "checkpoint", "native", "capture", "visible", "settle"]);
  });
  it("missing durable capture withholds output, retains checkpoint and never assumes admin recovery", async () => {
    const f = fixture(); f.captureFail(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" }); expect(f.events).toEqual(["admit", "checkpoint", "native", "capture"]); expect(f.receipts).toEqual([]);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "UNCERTAIN_OR_INFLIGHT" });
  });
  it.each([undefined, -1, "Infinity", "not-money"])("unqualified cost %s is unavailable, never zero", async (cost) => {
    const f = fixture(); const body = raw(); if (cost === undefined) { delete (body.usage as { cost?: unknown }).cost; } else { body.usage.cost = cost; } f.model.doGenerate = async () => generated("answer", body); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "TERMINAL_RESULT_WITHHELD" }); const receipt = JSON.parse(f.receipts[0]!); expect(receipt.costSource).toBe("unavailable"); expect(receipt).not.toHaveProperty("aggregateCostUsd");
  });
  it("root currency/aggregate rule unavailable retains cost even with a numeric field", async () => {
    const f = fixture(); f.r.dispatchEvidence = { ...f.r.dispatchEvidence, terminalCost: "unavailable" }; const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "TERMINAL_RESULT_WITHHELD" }); expect(JSON.parse(f.receipts[0]!).costSource).toBe("unavailable");
  });
  it("decimal/outward IEEE conversion cannot underestimate or accept exponent/NaN", () => {
    expect(conservativeUsdDecimal("0.0000001")).toBe("0.0000001"); expect(conservativeUsdDecimal(0.0005)).toBe("0.000501"); expect(conservativeUsdDecimal(Number.MIN_VALUE)).toBe("0.000001");
    expect(conservativeUsdDecimal("1e-6")).toBeUndefined(); expect(conservativeUsdDecimal(NaN)).toBeUndefined(); expect(conservativeUsdDecimal(-0)).toBeUndefined(); expect(conservativeUsdDecimal(Number.MAX_VALUE)).toBeUndefined();
  });
  it("single owned stream drains raw terminal and strips raw/reasoning, visibility precedes delivery", async () => {
    const f = fixture(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params()); const reader = result.stream.getReader(); const parts: LanguageModelV4StreamPart[] = [];
    for (;;) { const item = await reader.read(); if (item.done) break; parts.push(item.value); if (item.value.type === "text-delta") expect(f.events).toContain("visible"); }
    await h.lifecycle.complete(); expect(parts.map((x) => x.type)).toEqual(["text-start", "text-delta", "text-end", "finish"]); expect(JSON.stringify(parts)).not.toContain("SECRET"); expect(f.nativeCalls[0]!.includeRawChunks).toBe(true); expect(f.receipts).toHaveLength(1);
  });
  it("synthetic finish/EOF without raw provider terminal never records a receipt", async () => {
    const f = fixture(); f.model.doStream = async () => ({ stream: f.streamParts([{ type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage: generated().usage }]) });
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params()); await expect(result.stream.getReader().read()).rejects.toMatchObject({ code: "UNQUALIFIED_TERMINAL" }); await expect(h.lifecycle.complete()).rejects.toMatchObject({ code: "UNQUALIFIED_TERMINAL" }); expect(f.receipts).toEqual([]);
  });
  it("observer unsubscribe still drains and durably captures once", async () => {
    const f = fixture(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params()); await result.stream.cancel(); await h.lifecycle.complete(); expect(f.receipts).toHaveLength(1);
  });
  it("delivery revocation still drains to a known terminal and preserves charge", async () => {
    const f = fixture(); f.revoke(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params()); await expect(result.stream.getReader().read()).rejects.toMatchObject({ code: "DELIVERY_AUTHORITY_REVOKED" });
    await expect(h.lifecycle.complete()).rejects.toBeInstanceOf(Error); expect(f.receipts.length).toBeGreaterThan(0); expect(f.receipts.every((r) => !r.includes("SECRET_REASONING"))).toBe(true);
  });
  it("owner cancellation before call denies native dispatch", async () => {
    const f = fixture(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); h.lifecycle.cancel(); await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "RUN_CANCELLED" }); expect(f.count()).toBe(0); expect(f.events).toEqual([]);
  });
  it("owned cancellation after connection has honest unknown liability without fake terminal", async () => {
    const f = fixture(); f.model.doStream = async (input) => ({ stream: new ReadableStream({ start(c) { input.abortSignal!.addEventListener("abort", () => c.error(new Error("abort")), { once: true }); } }) });
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params()); const observation = result.stream.getReader().read(); h.lifecycle.cancel(); await expect(observation).rejects.toMatchObject({ code: "STREAM_INTERRUPTED" }); await expect(h.lifecycle.complete()).rejects.toMatchObject({ code: "STREAM_INTERRUPTED" }); expect(f.receipts).toEqual([]);
  });
  it("single embedding value preserves profile/range and rejects batch/options/dimensions before dispatch", async () => {
    const f = fixture(true); let count = 0; const calls: string[][] = []; const vector = Array.from({ length: 1536 }, () => 0.25);
    const model: EmbeddingModelV4 = { specificationVersion: "v4", modelId: DEFAULT_EMBEDDING_PROFILE.modelId, provider: "convexGateway.embedding", maxEmbeddingsPerCall: 512, supportsParallelCalls: true,
      doEmbed: async (input) => { count++; calls.push(input.values); return { embeddings: [vector], warnings: [], response: { body: { id: "embed-receipt", model: DEFAULT_EMBEDDING_PROFILE.modelId, data: [{ embedding: vector }], usage: { prompt_tokens: 1, cost: "0.000001" } } } }; } };
    const h = governGatewayEmbeddingModel(model, f.composition, { ...f.b, ordinal: 7 }, f.r); expect(h.model.maxEmbeddingsPerCall).toBe(1); const result = await h.model.doEmbed({ values: [" e\u0301\r\n "] }); expect(calls).toEqual([["é"]]); expect(result.embeddings[0]).toHaveLength(1536); expect(f.receipts).toHaveLength(1);
    const other = fixture(true); const o = governGatewayEmbeddingModel(model, other.composition, other.b, other.r); await expect(o.model.doEmbed({ values: ["a", "b"] })).rejects.toMatchObject({ code: "EMBEDDING_VALUE_BOUND" });
    await expect(o.model.doEmbed({ values: ["a"], providerOptions: { openaiCompatible: { dimensions: 10 } } })).rejects.toMatchObject({ code: "UNSUPPORTED_NATIVE_FIELD" }); expect(count).toBe(1);
    const wrong = structuredClone(other.r); (wrong.snapshot.semanticProfile as { dimensions: number }).dimensions = 3; expect(() => governGatewayEmbeddingModel(model, other.composition, other.b, wrong)).toThrow();
  });
  it("official compatible provider injected-fetch fixture preserves admitted body and output limit", async () => {
    const f = fixture(); const bodies: unknown[] = [];
    const provider = createOpenAICompatible({ name: "convexGateway", baseURL: "https://offline.invalid/v1", fetch: async (_url, init) => { bodies.push(JSON.parse(init!.body as string)); return new Response(JSON.stringify(raw()), { status: 200, headers: { "content-type": "application/json" } }); } });
    const h = governGatewayLanguageModel(provider(f.r.snapshot.modelId), f.composition, f.b, f.r); await h.model.doGenerate(params()); expect(bodies).toHaveLength(1); expect(bodies[0]).toMatchObject({ model: f.r.snapshot.modelId, messages: [{ role: "user", content: "hello" }], max_tokens: 16 }); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("official Responses injected-fetch fixture documents separate store:false/output mapping without governed readiness", async () => {
    const bodies: unknown[] = []; const provider = createOpenAI({ apiKey: "offline-placeholder", baseURL: "https://offline.invalid/v1", fetch: async (_u, init) => { bodies.push(JSON.parse(init!.body as string)); return new Response(JSON.stringify({ id: "response", object: "response", created_at: 1, model: "gpt-4o-mini", output: [], usage: { input_tokens: 1, output_tokens: 0, total_tokens: 1 } }), { status: 200, headers: { "content-type": "application/json" } }); } });
    await provider.responses("gpt-4o-mini").doGenerate({ ...params(), providerOptions: { openai: { store: false } } }); expect(bodies[0]).toMatchObject({ store: false, max_output_tokens: 16 }); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it.each([true, false])("official compatible SSE terminal=%s distinguishes genuine raw terminal from EOF flush", async (hasTerminal) => {
    const f = fixture(); const bodies: unknown[] = [];
    const chunks = [{ id: "convex-receipt", model: f.r.snapshot.modelId, choices: [{ index: 0, delta: { content: "answer" }, finish_reason: null }] },
      ...(hasTerminal ? [{ id: "convex-receipt", model: f.r.snapshot.modelId, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: raw().usage }] : [])];
    const provider = createOpenAICompatible({ name: "convexGateway", baseURL: "https://offline.invalid/v1", fetch: async (_u, init) => {
      bodies.push(JSON.parse(init!.body as string)); return new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    } });
    const h = governGatewayLanguageModel(provider(f.r.snapshot.modelId), f.composition, f.b, f.r); const result = await h.model.doStream(params()); const reader = result.stream.getReader();
    const collect = async () => { const parts = []; for (;;) { const item = await reader.read(); if (item.done) return parts; parts.push(item.value); } };
    if (hasTerminal) { expect((await collect()).map((p) => p.type)).toEqual(["text-start", "text-delta", "text-end", "finish"]); await h.lifecycle.complete(); expect(f.receipts).toHaveLength(1); }
    else { await expect(collect()).rejects.toMatchObject({ code: "UNQUALIFIED_TERMINAL" }); await expect(h.lifecycle.complete()).rejects.toMatchObject({ code: "UNQUALIFIED_TERMINAL" }); expect(f.receipts).toEqual([]); }
    expect(bodies[0]).toMatchObject({ stream: true, max_tokens: 16 }); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("official compatible embedding transforms a single normalized default-profile child", async () => {
    const f = fixture(true); const bodies: unknown[] = []; const vector = Array.from({ length: 1536 }, () => 0.25);
    const provider = createOpenAICompatible({ name: "convexGateway", baseURL: "https://offline.invalid/v1", fetch: async (_u, init) => {
      bodies.push(JSON.parse(init!.body as string)); return new Response(JSON.stringify({ id: "embed-receipt", model: DEFAULT_EMBEDDING_PROFILE.modelId, data: [{ index: 0, embedding: vector }], usage: { prompt_tokens: 1, total_tokens: 1, cost: "0.000001" } }), { headers: { "content-type": "application/json" } });
    } });
    const h = governGatewayEmbeddingModel(provider.embeddingModel(DEFAULT_EMBEDDING_PROFILE.modelId), f.composition, f.b, f.r);
    const result = await h.model.doEmbed({ values: [" e\u0301 "] }); expect(result.embeddings[0]).toHaveLength(1536); expect(bodies[0]).toMatchObject({ model: DEFAULT_EMBEDDING_PROFILE.modelId, input: ["é"] }); expect(f.receipts).toHaveLength(1); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("stream terminal capture failure remains pending and cannot trigger another native invocation", async () => {
    const f = fixture(); f.captureFail(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params());
    const reader = result.stream.getReader(); const consume = async () => { for (;;) { const item = await reader.read(); if (item.done) return; } };
    await expect(consume()).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" }); await expect(h.lifecycle.complete()).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" });
    await expect(h.model.doStream(params())).rejects.toMatchObject({ code: "UNCERTAIN_OR_INFLIGHT" }); expect(f.count()).toBe(1); expect(f.events.filter((e) => e === "capture")).toHaveLength(1); expect(f.events).not.toContain("settle");
  });

  it.each(["model", "input", "output"])("native %s qualification overrun preserves complete charge and withholds result", async (kind) => {
    const f = fixture(); const body = raw(); if (kind === "model") body.model = "openai/unqualified-model";
    if (kind === "input") body.usage.prompt_tokens = 100; if (kind === "output") body.usage.completion_tokens = 100;
    f.model.doGenerate = async () => generated("answer", body); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "QUALIFICATION_OVERRUN" }); expect(f.receipts).toHaveLength(1); expect(JSON.parse(f.receipts[0]!).aggregateCostUsd).toBe("0.0005"); expect(f.events).toContain("settle"); expect(f.events).not.toContain("visible");
  });

  it("owner retries retained sanitized terminal persistence without inference or unauthorized settlement", async () => {
    const f = fixture(); f.captureFail(); const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" }); await expect(h.lifecycle.complete()).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" });
    f.revoke(); f.captureResume(); expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(true); expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(false);
    expect(f.receipts).toHaveLength(1); expect(f.count()).toBe(1); expect(f.events).not.toContain("settle"); expect(f.receipts[0]).not.toContain("SECRET_REASONING"); await h.lifecycle.complete();
  });

  it("owned stream deadline covers initial connection, not just reader draining", async () => {
    const f = fixture(); f.model.doStream = async (input) => new Promise((_resolve, reject) => {
      input.abortSignal!.addEventListener("abort", () => reject(new Error("offline connection deadline")), { once: true });
    });
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); await expect(h.model.doStream(params())).rejects.toMatchObject({ code: "MODEL_INTERRUPTED" });
    expect(f.receipts).toEqual([]); expect(f.events.filter((e) => e === "checkpoint")).toHaveLength(1);
    await expect(h.model.doStream(params())).rejects.toMatchObject({ code: "RUN_CANCELLED" });
  });

});

function gate<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function collectParts(stream: ReadableStream<LanguageModelV4StreamPart>) {
  const parts: LanguageModelV4StreamPart[] = []; const reader = stream.getReader();
  try { for (;;) { const item = await reader.read(); if (item.done) break; parts.push(item.value); } } catch { /* Typed failure is checked independently via owner complete. */ }
  finally { reader.releaseLock(); }
  return parts;
}

describe("C2 owned cancellation and finite RPC lifetime", () => {
  it("cancel during paused visibility suppresses every subsequent part while buffered terminal charge is captured", async () => {
    const f = fixture(); const entered = gate<void>(); const release = gate<void>(); const prior = f.composition.ledger.markVisible;
    f.composition.ledger.markVisible = async (args) => { await prior(args); entered.resolve(); await release.promise; return { recorded: true }; };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params());
    await entered.promise; h.lifecycle.cancel(); release.resolve();
    const parts = await collectParts(result.stream); await h.lifecycle.complete().catch(() => undefined);
    expect(parts).toEqual([]); expect(f.receipts).toHaveLength(1); expect(f.count()).toBe(1); expect(JSON.parse(f.receipts[0]!).aggregateCostUsd).toBe("0.0005");
  });
  it("deadline bounds an unreleased authority RPC; late completion cannot reopen the observer", async () => {
    const f = fixture(); f.r.snapshot = { ...f.r.snapshot, limits: { ...f.r.snapshot.limits, timeoutMs: 20 } };
    const entered = gate<void>(); const release = gate<void>(); f.composition.ledger.markVisible = async () => { entered.resolve(); await release.promise; return { recorded: true }; };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params()); await entered.promise;
    let completed = false; const completion = h.lifecycle.complete().then(() => { completed = true; }, () => { completed = true; });
    await pause(70); const finishedAtDeadline = completed; release.resolve(); const parts = await collectParts(result.stream); await completion;
    expect(h.lifecycle.signal.aborted).toBe(true); expect({ finishedAtDeadline, parts }).toEqual({ finishedAtDeadline: true, parts: [] });
    expect(f.receipts).toHaveLength(1); expect(f.count()).toBe(1);
  });
});

const shortOwnedTiming = { terminalObservationMs: 20, terminalPersistenceMs: 20, cleanupMs: 20 };
describe("C2 finite terminal persistence and retained RPC outcomes", () => {
  it("slow capture is bounded; persistence retry joins its original flight and a late ack causes no second capture or inference", async () => {
    const f = fixture(); f.composition.ownedTiming = shortOwnedTiming; const entered = gate<void>(); const release = gate<void>(); const prior = f.composition.terminalSink.capture; let calls = 0;
    f.composition.terminalSink.capture = async (e) => { calls++; entered.resolve(); await release.promise; return prior(e); };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doGenerate(params()); const rejected = expect(operation).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" });
    await entered.promise; await rejected; expect(h.lifecycle.pendingWork().capture).toBe(1); expect(f.receipts).toEqual([]);
    await expect(h.lifecycle.retryPendingTerminalEvidence()).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" }); expect(calls).toBe(1);
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "UNCERTAIN_OR_INFLIGHT" }); expect(f.count()).toBe(1);
    release.resolve(); await pause(0); expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(true); expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(false);
    expect(calls).toBe(1); expect(f.receipts).toHaveLength(1); expect(h.lifecycle.pendingWork().capture).toBe(0); expect(f.events).not.toContain("settle"); await h.lifecycle.complete();
  });
  it("late capture rejection is handled; exact idempotent retry does not duplicate persisted charge evidence", async () => {
    const f = fixture(); f.composition.ownedTiming = shortOwnedTiming; const entered = gate<void>(); const release = gate<void>(); const attempted: string[] = []; const stored = new Set<string>(); let calls = 0; const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => { unhandled.push(error); }; process.on("unhandledRejection", onUnhandled);
    f.composition.terminalSink.capture = async (e) => {
      calls++; attempted.push(e.receiptCanonical); stored.add(e.receiptCanonical);
      if (calls === 1) { entered.resolve(); await release.promise; throw new Error("late private persistence detail"); }
      return { evidenceId: "same-evidence" };
    };
    try {
      const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doGenerate(params()); const rejected = expect(operation).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" });
      await entered.promise; await rejected; release.resolve(); await pause(0);
      expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(true); expect(attempted).toHaveLength(2); expect(attempted[0]).toBe(attempted[1]); expect(stored.size).toBe(1);
      expect(unhandled).toEqual([]); expect(f.count()).toBe(1); expect(f.events).not.toContain("settle"); await h.lifecycle.complete();
    } finally { process.off("unhandledRejection", onUnhandled); }
  });
  it("slow settlement is bounded after durable capture; late commit returns no output and is never automatically repeated", async () => {
    const f = fixture(); f.composition.ownedTiming = shortOwnedTiming; const entered = gate<void>(); const release = gate<void>(); const prior = f.composition.ledger.settle; let calls = 0; let outputs = 0;
    f.composition.ledger.settle = async (args) => { calls++; entered.resolve(); await release.promise; return prior(args); };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doGenerate(params()).then((result) => { outputs++; return result; }); const rejected = expect(operation).rejects.toMatchObject({ code: "TERMINAL_RECONCILIATION_PENDING" });
    await entered.promise; await rejected; await expect(h.lifecycle.complete()).rejects.toMatchObject({ code: "TERMINAL_RECONCILIATION_PENDING" });
    expect(f.receipts).toHaveLength(1); expect(h.lifecycle.pendingWork().settlement).toBe(1); release.resolve(); await pause(0);
    expect(outputs).toBe(0); expect(calls).toBe(1); expect(f.events.filter((x) => x === "settle")).toHaveLength(1); expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(false); await h.lifecycle.complete();
    await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "UNCERTAIN_OR_INFLIGHT" }); expect(f.count()).toBe(1);
  });
  it("late settlement failure stays reconciliation pending with sanitized error and no unhandled rejection", async () => {
    const f = fixture(); f.composition.ownedTiming = shortOwnedTiming; const entered = gate<void>(); const release = gate<void>(); const unhandled: unknown[] = []; let calls = 0;
    const onUnhandled = (error: unknown) => { unhandled.push(error); }; process.on("unhandledRejection", onUnhandled);
    f.composition.ledger.settle = async () => { calls++; entered.resolve(); await release.promise; throw new Error("SECRET_REMOTE_SETTLEMENT"); };
    try {
      const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doGenerate(params()); const rejected = expect(operation).rejects.toMatchObject({ code: "TERMINAL_RECONCILIATION_PENDING", message: "Governed model call did not complete for delivery." });
      await entered.promise; await rejected; release.resolve(); await pause(0); await expect(h.lifecycle.complete()).rejects.toMatchObject({ code: "TERMINAL_RECONCILIATION_PENDING" });
      expect(unhandled).toEqual([]); expect(f.receipts).toHaveLength(1); expect(calls).toBe(1); expect(f.count()).toBe(1); expect(h.lifecycle.pendingWork().settlement).toBe(0);
    } finally { process.off("unhandledRejection", onUnhandled); }
  });
  it("cancel while terminal visibility is paused retains charge and never attaches or delivers the generated private result", async () => {
    const f = fixture(); const entered = gate<void>(); const release = gate<void>(); const prior = f.composition.ledger.markVisible; const settled: string[] = []; const priorSettle = f.composition.ledger.settle;
    f.composition.ledger.markVisible = async (args) => { await prior(args); entered.resolve(); await release.promise; return { recorded: true }; };
    f.composition.ledger.settle = async (args) => { settled.push(args.receiptCanonical); return priorSettle(args); };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doGenerate(params()); const rejected = expect(operation).rejects.toBeInstanceOf(Error);
    await entered.promise; h.lifecycle.cancel(); await rejected; expect(f.receipts).toHaveLength(1); expect(settled).toHaveLength(1); expect(JSON.parse(settled[0]!)).not.toHaveProperty("privateResultCanonical");
    release.resolve(); await pause(0); expect(f.count()).toBe(1); expect(h.lifecycle.pendingWork().authority).toBe(0);
  });
  it("cancel while settlement is paused fences final output even when the issued current-authority RPC later succeeds", async () => {
    const f = fixture(); const entered = gate<void>(); const release = gate<void>(); const prior = f.composition.ledger.settle; let outputs = 0;
    f.composition.ledger.settle = async (args) => { const result = await prior(args); entered.resolve(); await release.promise; return result; };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doGenerate(params()).then((result) => { outputs++; return result; }); const rejected = expect(operation).rejects.toMatchObject({ code: "RUN_CANCELLED" });
    await entered.promise; h.lifecycle.cancel(); release.resolve(); await rejected;
    expect(outputs).toBe(0); expect(f.receipts).toHaveLength(1); expect(f.events.filter((x) => x === "settle")).toHaveLength(1); expect(f.count()).toBe(1);
  });
  it("observed genuine terminal is captured when EOF and native cancel never finish; cleanup remains finite", async () => {
    const f = fixture(); f.composition.ownedTiming = shortOwnedTiming; f.r.snapshot = { ...f.r.snapshot, limits: { ...f.r.snapshot.limits, timeoutMs: 20 } }; const canceled = gate<void>();
    f.model.doStream = async () => ({ stream: new ReadableStream<LanguageModelV4StreamPart>({ start(c) {
      c.enqueue({ type: "raw", rawValue: { id: "convex-receipt", model: f.r.snapshot.modelId, choices: [{ finish_reason: "stop" }], usage: raw().usage } });
    }, cancel: () => canceled.promise }) });
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params()); let completed = false;
    const completion = h.lifecycle.complete().then(() => { completed = true; }, () => { completed = true; }); const collection = collectParts(result.stream);
    await pause(100); expect(completed).toBe(true); expect(await collection).toEqual([]); expect(f.receipts).toHaveLength(1); expect(JSON.parse(f.receipts[0]!).aggregateCostUsd).toBe("0.0005");
    expect(h.lifecycle.pendingWork().cleanup).toBe(1); canceled.resolve(); await completion; await pause(0); expect(h.lifecycle.pendingWork().cleanup).toBe(0);
  });
  it("late authority rejection after its deadline remains handled and cannot reopen stream delivery", async () => {
    const f = fixture(); f.r.snapshot = { ...f.r.snapshot, limits: { ...f.r.snapshot.limits, timeoutMs: 20 } }; const entered = gate<void>(); const release = gate<void>(); const unhandled: unknown[] = [];
    const onUnhandled = (error: unknown) => { unhandled.push(error); }; process.on("unhandledRejection", onUnhandled);
    f.composition.ledger.markVisible = async () => { entered.resolve(); await release.promise; throw new Error("LATE_AUTHORITY_FAILURE"); };
    try {
      const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const result = await h.model.doStream(params()); await entered.promise; const parts = collectParts(result.stream);
      await h.lifecycle.complete().catch(() => undefined); release.resolve(); await pause(0);
      expect(await parts).toEqual([]); expect(unhandled).toEqual([]); expect(f.receipts).toHaveLength(1); expect(h.lifecycle.pendingWork().authority).toBe(0);
    } finally { process.off("unhandledRejection", onUnhandled); }
  });
  it("server timing cannot create an unbounded observation, persistence or cleanup phase", () => {
    const f = fixture(); f.composition.ownedTiming = { ...shortOwnedTiming, terminalPersistenceMs: Infinity };
    expect(() => governGatewayLanguageModel(f.model, f.composition, f.b, f.r)).toThrow(); expect(f.events).toEqual([]); expect(f.count()).toBe(0);
  });
});

describe("C2 initial native hook ownership", () => {
  it("complete joins a native connection that ignores abort through its finite observation window", async () => {
    const f = fixture(); f.composition.ownedTiming = shortOwnedTiming; f.r.snapshot = { ...f.r.snapshot, limits: { ...f.r.snapshot.limits, timeoutMs: 20 } }; const entered = gate<void>(); const release = gate<void>();
    f.model.doStream = async () => { entered.resolve(); await release.promise; throw new Error("LATE_NATIVE_FAILURE"); };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doStream(params()); const rejected = expect(operation).rejects.toMatchObject({ code: "MODEL_INTERRUPTED" }); await entered.promise;
    let completed = false; const completion = h.lifecycle.complete().then(() => { completed = true; }, () => { completed = true; });
    await pause(5); expect(completed).toBe(false); await rejected; await completion; expect(completed).toBe(true); expect(h.lifecycle.pendingWork().native).toBe(1); expect(f.receipts).toEqual([]);
    release.resolve(); await pause(0); expect(h.lifecycle.pendingWork().native).toBe(0);
  });
  it("complete joins a drain added after an already-owned native connection resolves", async () => {
    const f = fixture(); const entered = gate<void>(); const release = gate<void>(); const terminal = gate<void>();
    f.model.doStream = async () => { entered.resolve(); await release.promise; return { stream: new ReadableStream<LanguageModelV4StreamPart>({ start(c) {
      terminal.promise.then(() => { c.enqueue({ type: "raw", rawValue: { id: "convex-receipt", model: f.r.snapshot.modelId, choices: [{ finish_reason: "stop" }], usage: raw().usage } }); c.close(); });
    } }) }; };
    const h = governGatewayLanguageModel(f.model, f.composition, f.b, f.r); const operation = h.model.doStream(params()); await entered.promise;
    let completed = false; const completion = h.lifecycle.complete().then(() => { completed = true; }, () => { completed = true; }); release.resolve(); const result = await operation;
    await pause(5); expect(completed).toBe(false); terminal.resolve(); await completion; await collectParts(result.stream); expect(completed).toBe(true); expect(f.receipts).toHaveLength(1);
  });
});
