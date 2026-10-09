/** Actual adapter/native-handler composition with a fake DB and credential-free peer.
 * Synthetic qualifications do not attest a price/model or prove hosted Convex OCC. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { EmbeddingModelV4, LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4GenerateResult, LanguageModelV4StreamPart } from "@ai-sdk/provider";
import type { GatewayBinding } from "../../../convex-dev/runtimeGateway";
import type { BackendGatewayContext } from "../../../convex-dev/runtimeGatewayBackend";
import type { DeploymentPolicyManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { Doc } from "../../../convex-dev/_generated/dataModel";
import { canonicalModelJson, DEFAULT_CHAT_MODEL_ID } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, LARGE_EMBEDDING_PROFILE, semanticHash } from "../../../src/domain/profile";
import { FACTS_JSON_SCHEMA } from "../../../src/domain/extraction";
import { CONFLICT_DECISION_JSON_SCHEMA } from "../../../src/domain/conflicts";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";

const server = await import("convex/server");
const tokenLookup = jest.fn<() => Promise<string>>().mockRejectedValue(new Error("OFFLINE_TOKEN_PROHIBITED"));
jest.unstable_mockModule("convex/server", () => ({ ...server, getServiceToken: tokenLookup }));
let root: DeploymentPolicyManifest;
const lookup = jest.fn<(id: string, revision: number) => DeploymentPolicyManifest | undefined>();
const trustedBootstrap = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
jest.unstable_mockModule("../../../convex-dev/runtimeModelPolicyBootstrap", () => ({ qualifiedTerminalModelId: trustedBootstrap.qualifiedTerminalModelId,
  lookupDeploymentManifest: lookup,
  isTrustedDeploymentManifest: (entry: DeploymentPolicyManifest) => entry === root && entry.classification === "fixture-synthetic",
}));
const nativeLedger = await import("../../../convex-dev/runtimeModelPolicy");
const { createBackendGatewayComposition, createBackendGovernedGatewayModel, ensureBackendGatewayBudget } = await import("../../../convex-dev/runtimeGatewayBackend");
const { governGatewayLanguageModel, governGatewayEmbeddingModel } = await import("../../../convex-dev/runtimeGateway");
const clock = 1_000_000;
const secondModel = "openai/gpt-4o";
const hash = "a".repeat(64);
const limits = { inputTokens: 1000, contextTokens: 2000, outputTokens: 64, toolSteps: 4, timeoutMs: 1000,
  operationBudgetUnits: 200, runBudgetUnits: 300, tenantBudgetUnits: 500, concurrency: 2 };
const pins = { promptVersion: "p1", schemaVersion: "s1", extractionVersion: "e1", toolRegistryVersion: "t1", priceRevision: "price1", boundRevision: "bound1" };
function manifest(): DeploymentPolicyManifest {
  const qualifications = [DEFAULT_CHAT_MODEL_ID, secondModel].map((modelId, index) => ({
    receiptId: "synthetic-" + index, modelId, nativeInterface: "chat" as const, capabilities: ["text" as const], allowedOptions: ["temperature" as const], limits,
    costBound: { kind: "qualified-call-ceiling" as const, maximumCostUnits: 100, provenance: "SYNTHETIC-OFFLINE-ONLY", coversAllProviderCharges: true as const },
    priceRevision: pins.priceRevision, boundRevision: pins.boundRevision,
  }));
  return { manifestId: "synthetic-test-root", revision: 1, artifactRevision: "test-only", evidenceHash: hash, acceptanceHash: hash, classification: "fixture-synthetic",
    budgetWindowMs: 60_000, qualifications,
    policies: [{ policyId: "default", version: 1, scope: "deployment", rules: {
      modelId: DEFAULT_CHAT_MODEL_ID, nativeInterface: "chat", allowedModels: [DEFAULT_CHAT_MODEL_ID, secondModel], interfaces: ["chat"], capabilities: ["text"],
      allowedOptions: ["temperature"], allowedTools: [], fallbackModels: [], limits, pins,
    } }, { policyId: "title", version: 1, scope: "deployment", operationKey: "conversation.title", rules: { modelId: secondModel } }],
    dispatchEvidence: qualifications.map((qualification) => ({
      receiptId: qualification.receiptId, modelId: qualification.modelId, nativeInterface: "chat", evidenceHash: hash, providerVersion: "0.2.1",
      priceRevision: pins.priceRevision, boundRevision: pins.boundRevision, checkedAt: clock - 1, expiresAt: clock + 1_000_000,
      terminalCost: "gateway-aggregate-usd-v1", terminalProof: "provider-terminal-v1", supportsStream: true,
      inputBound: { ruleId: "plain-chat-cookbook-utf8-v1", featureEnvelope: "plain-chat-v1", revision: 1, proofHash: hash, documentHash: hash, nativeTransformHash: hash },
      resultBound: { maximumPrivateResultBytes: 60_000, maximumOutputTokens: 64, maximumEmbeddingValues: 1, proofHash: hash },
    })),
  };
}
type Call = { name: string; args: Record<string, unknown> };
const plainCopy = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fixture() {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run", "admin"];
  Object.assign(f.db, { patch: async (table: string, id: string, updates: Record<string, unknown>) => {
    const row = await f.db.get(table, id); if (!row) throw new Error("Missing patch row");
    f.db.writes++; Object.assign(row, plainCopy(updates));
  } });
  f.db.insert = async (table, value) => { f.db.writes++; return f.db.seed(table, plainCopy(value))._id; };
  // Serialization matches Convex plain values inside this Jest VM. Node's
  // structuredClone produces foreign-realm prototypes rejected by the real parser.
  f.db.transaction = async <T,>(run: () => Promise<T>): Promise<T> => {
    const before = new Map([...f.db.rows].map(([table, rows]) => [table, plainCopy(rows)]));
    const writes = f.db.writes; const sequence = f.db.sequence;
    try { return await run(); }
    catch (error) { f.db.rows = before; f.db.writes = writes; f.db.sequence = sequence; throw error; }
  };
  const calls: Call[] = [];
  const invoke = async (name: string, args: unknown): Promise<unknown> => {
    const registration = (nativeLedger as unknown as Record<string, unknown>)[name];
    return await registeredHandler<unknown, unknown>(registration)(f.ctx, args);
  };
  let captureFails = false;
  const rpc = async (reference: Parameters<typeof server.getFunctionName>[0], args: Record<string, unknown>) => {
    const name = server.getFunctionName(reference);
    expect(name.startsWith("runtimeModelPolicy:")).toBe(true);
    calls.push({ name, args: structuredClone(args) });
    if (captureFails && name.endsWith(":captureTerminalEvidence")) throw new Error("receipt persistence unavailable");
    return await invoke(name.split(":")[1]!, args);
  };
  const ctx = {
    runQuery: rpc,
    runMutation: async (reference: Parameters<typeof server.getFunctionName>[0], args: Record<string, unknown>) => await f.db.transaction(async () => await rpc(reference, args)),
  } as unknown as BackendGatewayContext;
  const composition = createBackendGatewayComposition(ctx);
  const install = async () => await f.db.transaction(async () => await invoke("installDeploymentPolicy", { manifestId: root.manifestId, expectedRevision: root.revision }));
  const bind = async (requestId = "request") => {
    const account = await ensureBackendGatewayBudget(ctx, { reference: f.reference, operationKey: "agent.respond", requestId, requestCanonical: canonicalModelJson({ text: "hello" }) });
    return { reference: f.reference, operationKey: "agent.respond", runBudgetId: account.runBudgetId, semanticId: requestId, ordinal: 0 } satisfies GatewayBinding;
  };
  const account = (kind: string) => f.db.table("runtimeBudgetAccounts").find((row) => row.kind === kind) as unknown as Doc<"runtimeBudgetAccounts">;
  const attempt = () => f.db.table("runtimeModelAttempts")[0] as unknown as Doc<"runtimeModelAttempts">;
  return { ...f, ctx, composition, calls, invoke, install, bind, account, attempt, captureFail: (failed: boolean) => { captureFails = failed; } };
}
const params = (): LanguageModelV4CallOptions => ({ prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }], maxOutputTokens: 16 });
function peer(modelId: string, afterDispatch?: () => void, cost: unknown = "0.000040") {
  let count = 0;
  const generate = (): LanguageModelV4GenerateResult => {
    count++; afterDispatch?.();
    return { content: [{ type: "text", text: "answer" }], finishReason: { unified: "stop", raw: "stop" }, warnings: [],
      usage: { inputTokens: { total: 8, noCache: 8, cacheRead: 0, cacheWrite: undefined }, outputTokens: { total: 2, text: 2, reasoning: 0 } },
      response: { body: { id: "offline-provider-terminal", model: modelId, choices: [{ finish_reason: "stop", message: { content: "answer" } }],
        usage: { prompt_tokens: 8, completion_tokens: 2, total_tokens: 10, cost } } },
    };
  };
  const model: LanguageModelV4 = { specificationVersion: "v4", provider: "convexGateway.chat", modelId, supportedUrls: {}, doGenerate: async () => generate(),
    doStream: async () => {
      const result = generate();
      const chunks: LanguageModelV4StreamPart[] = [
        { type: "text-start", id: "text" }, { type: "text-delta", id: "text", delta: "answer" }, { type: "text-end", id: "text" },
        { type: "raw", rawValue: result.response!.body }, { type: "finish", finishReason: result.finishReason, usage: result.usage },
      ];
      return { stream: new ReadableStream({ start: (controller) => { chunks.forEach((part) => controller.enqueue(part)); controller.close(); } }) };
    },
  };
  return { model, count: () => count };
}
async function governed(f: ReturnType<typeof fixture>, binding: GatewayBinding, afterDispatch?: () => void, cost: unknown = "0.000040") {
  const resolution = await f.composition.ledger.resolve(binding);
  const p = peer(resolution.snapshot.modelId, afterDispatch, cost);
  return { ...governGatewayLanguageModel(p.model, f.composition, binding, resolution), count: p.count, resolution };
}
beforeEach(() => {
  root = manifest(); lookup.mockReset(); lookup.mockImplementation((id, revision) => id === root.manifestId && revision === root.revision ? root : undefined);
  tokenLookup.mockClear(); jest.spyOn(Date, "now").mockReturnValue(clock);
});
afterEach(() => { jest.restoreAllMocks(); });

describe("confirmed result with intentionally unavailable cost — native and middleware", () => {
  it("preflights new exhausted foreground accounts and preserves exact cached bindings", async () => {
    const f = fixture(); await f.install(); const original = await f.bind();
    f.account("tenant").limitUnits = 99;
    const before = plainCopy([...f.db.rows]); const writes = f.db.writes;
    await expect(f.bind("new-exhausted-request")).rejects.toMatchObject({ data: { code: "BUDGET_EXCEEDED", outcome: "not_dispatched" } });
    expect(plainCopy([...f.db.rows])).toEqual(before); expect(f.db.writes).toBe(writes);
    const existing = await f.bind(); expect(existing.runBudgetId).toBe(original.runBudgetId);
    expect(plainCopy([...f.db.rows])).toEqual(before); expect(f.db.writes).toBe(writes);
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); expect(tokenLookup).not.toHaveBeenCalled();
  });
  function unknownCostRoot() {
    root = { ...root, dispatchEvidence: root.dispatchEvidence.map(proof => ({ ...proof, terminalCost: "unavailable" })) };
  }
  it("retains and narrowly replays a matching complete result without discounting any liability", async () => {
    unknownCostRoot(); const f = fixture(); await f.install(); const binding = await f.bind();
    const first = await governed(f, binding, undefined, null);
    try { expect((await first.model.doGenerate(params())).content).toEqual([{ type: "text", text: "answer" }]); }
    finally { await first.lifecycle.complete(); }
    expect(f.account("tenant")).toMatchObject({ settledUnits: 0, reservedUnits: 0, uncertainUnits: 100, activeConcurrency: 0 });
    expect(f.account("run")).toMatchObject({ settledUnits: 0, reservedUnits: 0, uncertainUnits: 100, activeConcurrency: 0 });
    expect(f.db.table("runtimeModelOperations")[0]).toMatchObject({ settledUnits: 0, reservedUnits: 0, uncertainUnits: 100 });
    expect(f.attempt()).toMatchObject({ state: "uncertain", resultAttachmentState: "attached", resultWithheld: false,
      slotReleased: true, outputVisible: true, privateResultCanonical: canonicalModelJson({ text: "answer" }) });
    expect(f.attempt().settledCostUnits).toBeUndefined();
    const accounts = plainCopy(f.db.table("runtimeBudgetAccounts"));
    const replay = await governed(f, binding);
    try {
      await expect(replay.model.doGenerate(params())).rejects.toMatchObject({ code: "REPLAY_AVAILABLE" });
      expect(await replay.lifecycle.consumeReplay()).toEqual({ text: "answer" });
      f.grant.revokedAt = clock; await expect(replay.lifecycle.consumeReplay()).rejects.toThrow();
    } finally { await replay.lifecycle.complete(); }
    expect(f.db.table("runtimeBudgetAccounts")).toEqual(accounts);
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(first.count()).toBe(1); expect(replay.count()).toBe(0);
    expect(f.calls.filter(call => call.name.endsWith(":captureTerminalEvidence"))).toHaveLength(1);
    expect(f.calls.filter(call => call.name.endsWith(":attachTerminalResult"))).toHaveLength(1);
    const operation = f.db.table("runtimeModelOperations")[0]!._id as GatewayBinding["parentOperationId"];
    delete f.grant.revokedAt;
    expect(await f.invoke("checkFallback", { reference: f.reference, attemptId: f.attempt()._id, candidateModelId: secondModel })).toEqual({ allowed: false });
    await expect(f.invoke("admitFallback", { reference: f.reference, attemptId: f.attempt()._id, candidateModelId: secondModel })).rejects.toThrow();
    expect(operation).toBeDefined();
  });
  it("an exact-parent secondary call consumes the same uncertain run ceiling and a later child cannot bypass quota", async () => {
    unknownCostRoot(); root = { ...root, policies: root.policies.map(policy => policy.scope === "deployment" && !policy.operationKey
      ? { ...policy, rules: { ...policy.rules, limits: { ...limits, runBudgetUnits: 200, tenantBudgetUnits: 200 } } } : policy) };
    const f = fixture(); await f.install(); const binding = await f.bind(); const first = await governed(f, binding, undefined, null);
    try { await first.model.doGenerate(params()); } finally { await first.lifecycle.complete(); }
    const parentOperationId = f.db.table("runtimeModelOperations")[0]!._id as GatewayBinding["parentOperationId"];
    const childBinding = { ...binding, operationKey: "conversation.title" as const, semanticId: "uncertain-title", ordinal: 1, parentOperationId };
    const child = await governed(f, childBinding, undefined, null);
    try { expect((await child.model.doGenerate(params())).content).toEqual([{ type: "text", text: "answer" }]); }
    finally { await child.lifecycle.complete(); }
    expect(child.resolution.snapshot.modelId).toBe(secondModel);
    expect(f.account("run")).toMatchObject({ uncertainUnits: 200, settledUnits: 0, reservedUnits: 0, activeConcurrency: 0 });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 200, settledUnits: 0, reservedUnits: 0, activeConcurrency: 0 });
    const denied = await governed(f, { ...childBinding, semanticId: "another-title", ordinal: 2 }, undefined, null);
    try { await expect(denied.model.doGenerate(params())).rejects.toMatchObject({ data: { code: "BUDGET_EXCEEDED" } }); }
    finally { await denied.lifecycle.complete(); }
    expect(denied.count()).toBe(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(2);
    const replay = await governed(f, binding);
    try { await expect(replay.model.doGenerate(params())).rejects.toMatchObject({ code: "REPLAY_AVAILABLE" }); expect(await replay.lifecycle.consumeReplay()).toEqual({ text: "answer" }); }
    finally { await replay.lifecycle.complete(); }
    expect(replay.count()).toBe(0); expect(f.account("run").uncertainUnits).toBe(200);
  });
  it.each(["missingModel", "missingUsage", "missingOutputUsage", "wrongModel", "tokenOverrun", "rejected"] as const)("native %s evidence cannot attach under unavailable-cost proof", async (kind) => {
    unknownCostRoot(); const f = fixture(); await f.install(); const binding = await f.bind(); const h = await governed(f, binding);
    // Exercise actual native admission/checkpoint, then the charge-only terminal and
    // independent attachment functions; no fabricated middleware acknowledgment.
    const request = { semanticId: binding.semanticId, childCallId: "caller-estimate", texts: ["hello"],
      messages: [{ role: "user", parts: [{ type: "text", text: "hello" }] }], inputTokens: 1, outputTokens: 16, toolSteps: 0,
      timeoutMs: limits.timeoutMs, reservationUnits: 1, promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion,
      extractionVersion: pins.extractionVersion, toolRegistryVersion: pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 } };
    const a = await f.composition.ledger.admit({ ...binding, requestCanonical: canonicalModelJson(request) });
    if (a.status !== "reserved") throw new Error("Expected native reservation");
    const permit = await f.composition.ledger.checkpoint({ reference: binding.reference, attemptId: a.attemptId, requestCanonical: a.requestCanonical });
    if (!permit.dispatchPermit) throw new Error("Expected native permit");
    const receipt: Record<string, unknown> = { version: 1, dispatchIdentity: permit.dispatchIdentity, receiptId: "complete-terminal",
      modelId: DEFAULT_CHAT_MODEL_ID, nativeInterface: "chat", outcome: "confirmed", proof: "provider-terminal-v1", costSource: "unavailable",
      actualModel: DEFAULT_CHAT_MODEL_ID, usage: { inputTokens: 8, outputTokens: 2 } };
    if (kind === "missingModel") delete receipt.actualModel;
    if (kind === "missingUsage") delete receipt.usage;
    if (kind === "missingOutputUsage") receipt.usage = { inputTokens: 8 };
    if (kind === "wrongModel") receipt.actualModel = secondModel;
    if (kind === "tokenOverrun") receipt.usage = { inputTokens: 8, outputTokens: 17 };
    if (kind === "rejected") receipt.outcome = "confirmed_rejected";
    const capture = await f.composition.terminalSink.capture({ attemptId: a.attemptId, dispatchIdentity: permit.dispatchIdentity, receiptCanonical: canonicalModelJson(receipt) });
    expect(await f.composition.ledger.attachTerminalResult({ reference: binding.reference, attemptId: a.attemptId, evidenceId: capture.evidenceId,
      privateResultCanonical: canonicalModelJson({ text: "answer" }) })).toEqual({ attached: false, resultWithheld: true });
    expect(f.attempt()).toMatchObject({ state: "uncertain", resultAttachmentState: "closed", resultWithheld: true, slotReleased: true });
    expect(f.attempt().privateResultCanonical).toBeUndefined();
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, settledUnits: 0, activeConcurrency: 0 });
    await h.lifecycle.complete();
  });
  it.each(["revokedGrant", "cancelled", "tokenOverrun"] as const)("unavailable cost does not weaken %s delivery denial", async (kind) => {
    unknownCostRoot(); const f = fixture(); await f.install(); const binding = await f.bind();
    const h = await governed(f, binding, () => {
      if (kind === "revokedGrant") f.grant.revokedAt = clock;
      if (kind === "cancelled") f.db.table("runtimeBudgetAccounts").find(row => row.kind === "run")!.cancelled = true;
    }, null);
    try { await expect(h.model.doGenerate({ ...params(), ...(kind === "tokenOverrun" ? { maxOutputTokens: 1 } : {}) })).rejects.toThrow(); }
    finally { await h.lifecycle.complete(); }
    expect(f.attempt()).toMatchObject({ state: "uncertain", resultAttachmentState: "closed", resultWithheld: true });
    expect(f.attempt().privateResultCanonical).toBeUndefined(); expect(h.count()).toBe(1);
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, settledUnits: 0, activeConcurrency: 0 });
  });
});

function embeddingRoot(terminalModelId?: string) {
  const modelId = DEFAULT_EMBEDDING_PROFILE.modelId;
  const qualification = { ...root.qualifications[0]!, receiptId: "synthetic-embedding", modelId, nativeInterface: "embedding" as const, capabilities: ["embedding" as const] };
  root = { ...root, qualifications: [...root.qualifications, qualification],
    policies: [{ ...root.policies[0]!, rules: { ...root.policies[0]!.rules,
      allowedModels: [DEFAULT_CHAT_MODEL_ID, secondModel, modelId], interfaces: ["chat", "embedding"], capabilities: ["text", "embedding"] } }, root.policies[1]!,
    { policyId: "embedding", version: 1, scope: "deployment", operationKey: "embedding.query", rules: { modelId, nativeInterface: "embedding" } }],
    dispatchEvidence: [...root.dispatchEvidence, { ...root.dispatchEvidence[0]!, receiptId: qualification.receiptId, modelId, nativeInterface: "embedding",
      ...(terminalModelId !== undefined ? { terminalModelId } : {}),
      inputBound: { ...root.dispatchEvidence[0]!.inputBound, ruleId: "default-embedding-utf8-v1", featureEnvelope: "default-embedding-v1" },
      resultBound: { ...root.dispatchEvidence[0]!.resultBound, maximumOutputTokens: 0 } }] };
}
function embeddingPeer(wireModel: string) {
  let count = 0; const vector = Array<number>(1536).fill(0.1);
  const model: EmbeddingModelV4 = { specificationVersion: "v4", provider: "convexGateway.embedding", modelId: DEFAULT_EMBEDDING_PROFILE.modelId,
    maxEmbeddingsPerCall: 1, supportsParallelCalls: true, doEmbed: async () => { count++; return { embeddings: [vector], warnings: [],
      response: { body: { id: "offline-embedding-terminal", model: wireModel, data: [{ index: 0, embedding: vector }], usage: { prompt_tokens: 1, total_tokens: 1, cost: "0.000001" } } } }; } };
  return { model, count: () => count };
}

describe("actual-service regressions — native terminal identity and semantic schemas", () => {
  it("retains default-profile vector replay under intentionally unknown cost without another dispatch or liability refund", async () => {
    embeddingRoot("text-embedding-3-small");
    root = { ...root, dispatchEvidence: root.dispatchEvidence.map(proof => ({ ...proof, terminalCost: "unavailable" })) };
    const f = fixture(); await f.install(); const binding = { ...await f.bind(), operationKey: "embedding.query" as const };
    const resolution = await f.composition.ledger.resolve(binding); const p = embeddingPeer("text-embedding-3-small");
    const h = governGatewayEmbeddingModel(p.model, f.composition, binding, resolution);
    let vectors: number[][];
    try { vectors = (await h.model.doEmbed({ values: ["x"] })).embeddings; }
    finally { await h.lifecycle.complete(); }
    expect(vectors[0]).toHaveLength(1536);
    expect(f.attempt()).toMatchObject({ state: "uncertain", slotReleased: true, resultWithheld: false, resultAttachmentState: "attached" });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, settledUnits: 0, reservedUnits: 0, activeConcurrency: 0 });
    const replay = governGatewayEmbeddingModel(p.model, f.composition, binding, resolution);
    try {
      await expect(replay.model.doEmbed({ values: ["x"] })).rejects.toMatchObject({ code: "REPLAY_AVAILABLE" });
      expect(await replay.lifecycle.consumeReplay()).toEqual({ profile: DEFAULT_EMBEDDING_PROFILE, vectors });
    } finally { await replay.lifecycle.complete(); }
    expect(p.count()).toBe(1); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(f.account("run").uncertainUnits).toBe(100);
  });
  it.each([
    ["text-embedding-3-small", "text-embedding-3-small", true],
    [undefined, "text-embedding-3-small", false],
    ["text-embedding-3-small", "text-embedding-3-large", false],
    ["text-embedding-3-small", "foreign/text-embedding-3-small", false],
  ] as const)("requires the exact trusted wire identity %s / %s", async (qualified, observed, allowed) => {
    embeddingRoot(qualified); const f = fixture(); await f.install();
    const binding = { ...await f.bind(), operationKey: "embedding.query" as const };
    const resolution = await f.composition.ledger.resolve(binding); const p = embeddingPeer(observed);
    const h = governGatewayEmbeddingModel(p.model, f.composition, binding, resolution);
    if (allowed) {
      expect((await h.model.doEmbed({ values: ["x"] })).embeddings[0]).toHaveLength(1536);
      expect(f.account("run").overrun).toBe(false); expect(f.attempt().privateResultCanonical).toBeDefined();
      const replay = governGatewayEmbeddingModel(p.model, f.composition, binding, resolution);
      await expect(replay.model.doEmbed({ values: ["x"] })).rejects.toMatchObject({ code: "REPLAY_AVAILABLE" });
      expect(await replay.lifecycle.consumeReplay()).toMatchObject({ profile: DEFAULT_EMBEDDING_PROFILE });
      await replay.lifecycle.complete();
    } else {
      await expect(h.model.doEmbed({ values: ["x"] })).rejects.toMatchObject({ code: "QUALIFICATION_OVERRUN" });
      expect(f.account("run").overrun).toBe(true); expect(f.attempt().privateResultCanonical).toBeUndefined();
    }
    expect(JSON.parse(f.attempt().receiptCanonical!).actualModel).toBe(observed);
    expect(f.account("run").settledUnits).toBe(1); expect(f.account("run").activeConcurrency).toBe(0); expect(p.count()).toBe(1);
    await h.lifecycle.complete();
  });
  it("rejects a foreign compiled alias before account/native effects", async () => {
    embeddingRoot("text-embedding-3-large"); const f = fixture();
    await expect(f.install()).rejects.toMatchObject({ data: { code: "CAPABILITY_UNAVAILABLE" } });
    expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(0); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it.each(["memory.extract", "facts.resolve"] as const)("binds fixed %s semantic schema to admission without native response_format", async (operationKey) => {
    const schemaVersion = operationKey === "memory.extract" ? "facts-v1" : "conflicts-v1";
    root = { ...root, qualifications: root.qualifications.map(q => ({ ...q, capabilities: ["text", "structured"] })),
      policies: root.policies.map(p => p.policyId === "default" ? { ...p, rules: { ...p.rules, capabilities: ["text", "structured"], pins: { ...pins, schemaVersion } } } : p) };
    const f = fixture(); await f.install(); const content = "x"; const contentHash = await semanticHash(content);
    f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
      lineage: { sourceId: "schema-source", sourceEventId: "schema-event", sourceRevision: 1, role: "user", trust: "user_assertion" }, content, contentHash, createdAt: clock });
    const binding = { ...await f.bind(), operationKey, source: { sourceId: "schema-source", sourceEventId: "schema-event", sourceRevision: 1, contentHash } };
    const h = await governed(f, binding); await h.model.doGenerate(params()); await h.lifecycle.complete();
    const admission = f.calls.find(c => c.name.endsWith(":admit"))!;
    const request = JSON.parse(admission.args.requestCanonical as string);
    expect(request.outputSchema).toEqual(operationKey === "memory.extract" ? FACTS_JSON_SCHEMA : CONFLICT_DECISION_JSON_SCHEMA);
    expect(request.schemaVersion).toBe(schemaVersion); expect(h.count()).toBe(1);
    expect(f.account("run").settledUnits).toBe(40); expect(f.attempt().privateResultCanonical).toBeDefined();
    expect(() => nativeLedger.deriveQualifiedInputBound(root.dispatchEvidence[0]!, { ...request, outputSchema: { type: "object" } })).toThrow();
  });
});

describe("backend ActionCtx Gateway adapter — offline native composition", () => {
  it("binds an idempotent native budget and denies changed request identity", async () => {
    const f = fixture(); await f.install(); const first = await f.bind(); expect(await f.bind()).toEqual(first);
    expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(2);
    await expect(ensureBackendGatewayBudget(f.ctx, { reference: f.reference, operationKey: "agent.respond", requestId: "request", requestCanonical: canonicalModelJson({ text: "changed" }) })).rejects.toMatchObject({ data: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(2); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("constructs the official model without minting a token, and quota denies before token lookup", async () => {
    const f = fixture(); await f.install(); const binding = await f.bind();
    const h = await createBackendGovernedGatewayModel(f.ctx, binding);
    expect(h.model).toMatchObject({ modelId: DEFAULT_CHAT_MODEL_ID, provider: "convexGateway.chat" });
    expect(tokenLookup).not.toHaveBeenCalled(); f.account("tenant").limitUnits = 1;
    try { await expect((h.model as LanguageModelV4).doGenerate(params())).rejects.toMatchObject({ data: { code: "BUDGET_EXCEEDED" } }); }
    finally { await h.lifecycle.complete(); }
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("rejects absent qualification and cross-tenant/current-version authority before provider construction", async () => {
    const f = fixture(); await f.install(); const binding = await f.bind();
    await expect(createBackendGovernedGatewayModel(f.ctx, { ...binding, reference: { ...f.reference, tenantId: "other" } })).rejects.toThrow();
    await expect(createBackendGovernedGatewayModel(f.ctx, { ...binding, reference: { ...f.reference, grantVersion: 2 } })).rejects.toThrow();
    lookup.mockReturnValue(undefined); await expect(createBackendGovernedGatewayModel(f.ctx, binding)).rejects.toMatchObject({ data: { code: "CAPABILITY_UNAVAILABLE" } });
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("composes admission/checkpoint/charge-only settlement and private attachment without a second settle", async () => {
    const f = fixture(); await f.install(); const binding = await f.bind(); const h = await governed(f, binding);
    try { expect((await h.model.doGenerate(params())).content).toEqual([{ type: "text", text: "answer" }]); }
    finally { await h.lifecycle.complete(); }
    expect(f.calls.map((call) => call.name)).toEqual(["runtimeModelPolicy:ensureBudget", "runtimeModelPolicy:resolve", "runtimeModelPolicy:admit", "runtimeModelPolicy:checkpoint", "runtimeModelPolicy:captureTerminalEvidence", "runtimeModelPolicy:attachTerminalResult"]);
    const charge = f.calls.find((call) => call.name.endsWith(":captureTerminalEvidence"))!.args;
    expect(Object.keys(charge).sort()).toEqual(["attemptId", "dispatchIdentity", "receiptCanonical"]);
    expect(JSON.parse(charge.receiptCanonical as string)).toMatchObject({ aggregateCostUsd: "0.000040", costSource: "gateway-aggregate-usd-v1" });
    expect(charge).not.toHaveProperty("reference"); expect(charge.receiptCanonical).not.toContain("answer");
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 0, uncertainUnits: 0, settledUnits: 40, activeConcurrency: 0 });
    expect(f.attempt()).toMatchObject({ state: "settled", outputVisible: true, privateResultCanonical: canonicalModelJson({ text: "answer" }) });
    expect(h.count()).toBe(1); expect(h.lifecycle.pendingWork()).toEqual({ authority: 0, capture: 0, settlement: 0, native: 0, reader: 0, cleanup: 0 });
  });
  it.each(["revokedGrant", "tenantTombstone", "sourceTombstone"] as const)("%s during dispatch retains known charge and withholds private output", async (kind) => {
    const f = fixture(); await f.install(); const binding = await f.bind();
    if (kind === "sourceTombstone") {
      const contentHash = await semanticHash("hello");
      f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
        lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" }, content: "hello", contentHash, createdAt: clock });
      Object.assign(binding, { source: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash } });
    }
    const h = await governed(f, binding, () => {
      if (kind === "revokedGrant") f.grant.revokedAt = clock;
      else if (kind === "tenantTombstone") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, resourceType: "tenant", resourceId: f.reference.tenantId, deletedAt: clock });
      else f.db.table("runtimeMemorySources")[0]!.tombstonedAt = clock;
    });
    try { await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "TERMINAL_RESULT_WITHHELD" }); }
    finally { await h.lifecycle.complete(); }
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 0, uncertainUnits: 0, activeConcurrency: 0 });
    expect(f.attempt()).toMatchObject({ state: "settled", resultWithheld: true, resultAttachmentState: "closed" });
    expect(f.attempt().privateResultCanonical).toBeUndefined(); expect(h.count()).toBe(1); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("keeps unknown cost reserved as uncertain and prohibits replay or fallback inference", async () => {
    const f = fixture(); await f.install(); const binding = await f.bind(); const h = await governed(f, binding, undefined, null);
    try {
      await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "TERMINAL_RESULT_WITHHELD" });
      await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "UNCERTAIN_OR_INFLIGHT" });
    } finally { await h.lifecycle.complete(); }
    expect(f.account("tenant")).toMatchObject({ settledUnits: 0, reservedUnits: 0, uncertainUnits: 100, activeConcurrency: 0 });
    expect(f.attempt()).toMatchObject({ state: "uncertain", resultWithheld: true }); expect(f.attempt().privateResultCanonical).toBeUndefined(); expect(h.count()).toBe(1);
    expect(f.calls.filter((call) => call.name.endsWith(":attachTerminalResult"))).toHaveLength(0);
  });
  it("retries only retained terminal persistence, preserving the exact charge tuple and single inference", async () => {
    const f = fixture(); await f.install(); const binding = await f.bind(); const h = await governed(f, binding); f.captureFail(true);
    try {
      await expect(h.model.doGenerate(params())).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" });
      expect(f.account("tenant")).toMatchObject({ reservedUnits: 100, activeConcurrency: 1 });
      f.captureFail(false); expect(await h.lifecycle.retryPendingTerminalEvidence()).toBe(true);
    } finally { await h.lifecycle.complete(); }
    const captures = f.calls.filter((call) => call.name.endsWith(":captureTerminalEvidence"));
    expect(captures).toHaveLength(2); expect(captures[0]!.args).toEqual(captures[1]!.args); expect(h.count()).toBe(1);
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 0, activeConcurrency: 0 });
    expect(f.attempt().privateResultCanonical).toBeUndefined();
  });
  it("replays only authorized persisted text, without another reservation or native call", async () => {
    const f = fixture(); await f.install(); const binding = await f.bind(); const first = await governed(f, binding);
    try { await first.model.doGenerate(params()); } finally { await first.lifecycle.complete(); }
    const replay = await governed(f, binding);
    try {
      await expect(replay.model.doGenerate(params())).rejects.toMatchObject({ code: "REPLAY_AVAILABLE" });
      expect(await replay.lifecycle.consumeReplay()).toEqual({ text: "answer" });
      f.grant.revokedAt = clock; await expect(replay.lifecycle.consumeReplay()).rejects.toThrow();
    } finally { await replay.lifecycle.complete(); }
    expect(replay.count()).toBe(0); expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 0, activeConcurrency: 0 });
  });
  it("uses a distinct secondary function policy and parent identity while sharing the trusted run quota", async () => {
    const f = fixture(); await f.install(); const binding = await f.bind(); const parent = await governed(f, binding);
    try { await parent.model.doGenerate(params()); } finally { await parent.lifecycle.complete(); }
    const operationId = f.db.table("runtimeModelOperations")[0]!._id as GatewayBinding["parentOperationId"];
    const childBinding = { ...binding, operationKey: "conversation.title" as const, semanticId: "title-1", ordinal: 1, parentOperationId: operationId };
    const official = await createBackendGovernedGatewayModel(f.ctx, childBinding);
    try { expect(official.model.modelId).toBe(secondModel); }
    finally { await official.lifecycle.complete(); }
    const child = await governed(f, childBinding);
    try { await child.model.doGenerate(params()); } finally { await child.lifecycle.complete(); }
    expect(child.resolution.snapshot.modelId).toBe(secondModel);
    expect(child.resolution.snapshot.parentOperationId).toBe(operationId);
    expect(f.calls.filter((call) => call.name.endsWith(":resolve")).at(-1)!.args).toEqual({
      reference: f.reference, operationKey: "conversation.title", runBudgetId: binding.runBudgetId, parentOperationId: operationId,
    });
    expect(f.calls.filter((call) => call.name.endsWith(":admit"))[1]!.args).toMatchObject({ parentOperationId: operationId, operationKey: "conversation.title", ordinal: 1, runBudgetId: binding.runBudgetId });
    expect(f.account("run")).toMatchObject({ settledUnits: 80, activeConcurrency: 0 });
    const childRow = f.db.table("runtimeModelOperations")[1]!;
    expect(JSON.parse(childRow.snapshotCanonical as string).qualificationReceiptId).toBe("synthetic-1");
    expect(parent.count()).toBe(1); expect(child.count()).toBe(1);
  });
  it("rejects a parent from another run and a required-source secondary call before dispatch", async () => {
    const f = fixture(); await f.install(); const parentBinding = await f.bind(); const parent = await governed(f, parentBinding);
    try { await parent.model.doGenerate(params()); } finally { await parent.lifecycle.complete(); }
    const operationId = f.db.table("runtimeModelOperations")[0]!._id as GatewayBinding["parentOperationId"];
    const binding = await f.bind("other-request");
    await expect(createBackendGovernedGatewayModel(f.ctx, { ...binding, operationKey: "conversation.title", parentOperationId: operationId })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    await expect(f.composition.ledger.resolve({ ...binding, operationKey: "memory.extract" })).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it.each(["cancelled", "sourceTombstone"] as const)("rechecks the parent's %s before child model construction", async (kind) => {
    const f = fixture(); await f.install(); const binding = await f.bind();
    const contentHash = await semanticHash("hello");
    f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
      lineage: { sourceId: "parent-source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" }, content: "hello", contentHash, createdAt: clock });
    const parent = await governed(f, { ...binding, source: { sourceId: "parent-source", sourceEventId: "event", sourceRevision: 1, contentHash } });
    try { await parent.model.doGenerate(params()); } finally { await parent.lifecycle.complete(); }
    const operation = f.db.table("runtimeModelOperations")[0]!;
    if (kind === "cancelled") operation.cancelled = true;
    else f.db.table("runtimeMemorySources")[0]!.tombstonedAt = clock;
    await expect(createBackendGovernedGatewayModel(f.ctx, { ...binding, operationKey: "conversation.title", semanticId: "child",
      parentOperationId: operation._id as GatewayBinding["parentOperationId"] })).rejects.toMatchObject({ data: { code: kind === "cancelled" ? "RUN_CANCELLED" : "FORBIDDEN" } });
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("records streamed visibility through native current-authority checks before delivering text", async () => {
    const f = fixture(); await f.install(); const binding = await f.bind(); const h = await governed(f, binding);
    const output: LanguageModelV4StreamPart[] = [];
    try {
      const result = await h.model.doStream(params()); const reader = result.stream.getReader();
      try { for (;;) { const chunk = await reader.read(); if (chunk.done) break; output.push(chunk.value); } }
      finally { reader.releaseLock(); }
    } finally { await h.lifecycle.complete(); }
    expect(output.some((part) => part.type === "text-delta" && part.delta === "answer")).toBe(true);
    expect(f.calls.filter((call) => call.name.endsWith(":markVisible")).map((call) => call.args)).toContainEqual({ reference: f.reference, attemptId: f.attempt()._id,
      outputVisible: true, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false });
    expect(f.attempt().outputVisible).toBe(true); expect(f.account("tenant").settledUnits).toBe(40);
  });
  it("does not manufacture a successful visibility acknowledgment from a failed internal RPC", async () => {
    const f = fixture(); const invalid = createBackendGatewayComposition({ ...f.ctx, runMutation: async () => ({ recorded: false }) } as unknown as BackendGatewayContext);
    await expect(invalid.ledger.markVisible({ reference: f.reference, attemptId: "attempt" as Doc<"runtimeModelAttempts">["_id"], outputVisible: true,
      toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false })).rejects.toMatchObject({ code: "VISIBILITY_NOT_RECORDED" });
  });
});


describe("qualified profile-specific native embedding envelopes (offline)", () => {
  function embeddingRoot(large: boolean) {
    const profile = large ? LARGE_EMBEDDING_PROFILE : DEFAULT_EMBEDDING_PROFILE;
    const q = { ...root.qualifications[0]!, receiptId: "offline-profile", modelId: profile.modelId, nativeInterface: "embedding" as const,
      capabilities: ["embedding" as const], allowedOptions: [] };
    root = { ...root, qualifications: [q], policies: [{ ...root.policies[0]!, rules: { ...root.policies[0]!.rules,
      modelId: profile.modelId, nativeInterface: "embedding", allowedModels: [profile.modelId], interfaces: ["embedding"], capabilities: ["embedding"], allowedOptions: [] } }],
      dispatchEvidence: [{ ...root.dispatchEvidence[0]!, receiptId: q.receiptId, modelId: profile.modelId, nativeInterface: "embedding",
        terminalModelId: large ? "text-embedding-3-large" : "text-embedding-3-small",
        ...(large ? { embeddingProfile: profile } : {}),
        inputBound: { ...root.dispatchEvidence[0]!.inputBound, ruleId: large ? "profile-embedding-utf8-v1" : "default-embedding-utf8-v1",
          featureEnvelope: large ? "profile-embedding-v1" : "default-embedding-v1" },
        resultBound: { ...root.dispatchEvidence[0]!.resultBound, maximumPrivateResultBytes: large ? 131072 : 60000 } }] };
    return profile;
  }
  it.each([false, true])("pins native profile/dimensions, terminal alias and replay bytes (large=%s)", async large => {
    const profile = embeddingRoot(large); const f = fixture(); await f.install();
    const budget = await ensureBackendGatewayBudget(f.ctx, { reference: f.reference, operationKey: "embedding.query", requestId: "profile-native", requestCanonical: canonicalModelJson({ text: "orchid" }) });
    const binding = { reference: f.reference, operationKey: "embedding.query" as const, runBudgetId: budget.runBudgetId, semanticId: "orchid", ordinal: 0 };
    const resolution = await f.composition.ledger.resolve(binding);
    expect(resolution.snapshot.semanticProfile).toEqual(profile); expect(resolution.storageLimits.privateResultBytes).toBe(large ? 131072 : 60000);
    let calls = 0; const vector = Array(profile.dimensions).fill(0.12345678901234567) as number[];
    const model: EmbeddingModelV4 = { specificationVersion: "v4", provider: "convexGateway.embedding", modelId: profile.modelId,
      maxEmbeddingsPerCall: 1, supportsParallelCalls: false, doEmbed: async () => { calls++; return { embeddings: [vector], warnings: [],
        response: { body: { id: "embedding-terminal", model: root.dispatchEvidence[0]!.terminalModelId, data: [{ embedding: vector }], usage: { prompt_tokens: 6, total_tokens: 6, cost: "0.000040" } } } }; } };
    const first = governGatewayEmbeddingModel(model, f.composition, binding, resolution);
    try { expect((await first.model.doEmbed({ values: ["orchid"] })).embeddings[0]).toHaveLength(profile.dimensions); }
    finally { await first.lifecycle.complete(); }
    expect(calls).toBe(1); expect(f.attempt().resultAttachmentState).toBe("attached");
    const encoded = f.attempt().privateResultCanonical!; const bytes = new TextEncoder().encode(encoded).length;
    expect(bytes).toBeLessThanOrEqual(large ? 131072 : 60000); if (large) expect(bytes).toBeGreaterThan(60000);
    expect(JSON.parse(encoded).profile).toEqual(profile); expect(f.account("run")).toMatchObject({ reservedUnits: 0, settledUnits: 40, activeConcurrency: 0 });
    const replay = governGatewayEmbeddingModel(model, f.composition, binding, resolution);
    try { await expect(replay.model.doEmbed({ values: ["orchid"] })).rejects.toMatchObject({ code: "REPLAY_AVAILABLE" });
      expect(await replay.lifecycle.consumeReplay()).toEqual({ profile, vectors: [vector] }); }
    finally { await replay.lifecycle.complete(); }
    expect(calls).toBe(1); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it.each(["small-wide-result", "large-wrong-dimension", "large-alias"])("rejects unqualified %s before any budget or token lookup", async kind => {
    embeddingRoot(kind !== "small-wide-result");
    const p = root.dispatchEvidence[0]!;
    root = { ...root, dispatchEvidence: [{ ...p, ...(kind === "small-wide-result" ? { resultBound: { ...p.resultBound, maximumPrivateResultBytes: 131072 } }
      : kind === "large-wrong-dimension" ? { embeddingProfile: { ...LARGE_EMBEDDING_PROFILE, dimensions: 1536 } } : { terminalModelId: "azure/text-embedding-3-large" }) }] };
    const f = fixture(); await expect(f.install()).rejects.toThrow(); expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(0);
    expect(f.db.writes).toBe(0); expect(tokenLookup).not.toHaveBeenCalled();
  });
  it("does not let native small resolution metadata widen its60000-byte storage contract", async () => {
    const profile = embeddingRoot(false); const f = fixture(); await f.install();
    const budget = await ensureBackendGatewayBudget(f.ctx, { reference: f.reference, operationKey: "embedding.query", requestId: "small-storage", requestCanonical: "{}" });
    const binding = { reference: f.reference, operationKey: "embedding.query" as const, runBudgetId: budget.runBudgetId, semanticId: "storage", ordinal: 0 };
    const resolution = await f.composition.ledger.resolve(binding);
    const model: EmbeddingModelV4 = { specificationVersion: "v4", provider: "convexGateway.embedding", modelId: profile.modelId,
      maxEmbeddingsPerCall: 1, supportsParallelCalls: false, doEmbed: async () => { throw new Error("must not dispatch"); } };
    expect(() => governGatewayEmbeddingModel(model, f.composition, binding, { ...resolution,
      storageLimits: { ...resolution.storageLimits, privateResultBytes: 131072 } })).toThrow(expect.objectContaining({ code: "CAPABILITY_UNAVAILABLE" }));
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(0); expect(tokenLookup).not.toHaveBeenCalled();
    expect(f.account("run")).toMatchObject({ activeConcurrency: 0, reservedUnits: 0, settledUnits: 0, uncertainUnits: 0 });
  });
});
