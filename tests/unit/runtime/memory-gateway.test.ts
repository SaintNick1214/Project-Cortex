/** Offline adapter outcomes through the real governed V4 middleware. The official
 * factory and backend RPC ports are controlled peers, never price/service evidence. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { EmbeddingModelV4, LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import type { MemoryModel, MemoryRepository, SourceContent } from "../../../src/domain/contracts";
import type { GatewayBinding, GatewayComposition, GatewayLifecycle, GatewayResolution } from "../../../convex-dev/runtimeGateway";
import type { BackendGatewayContext } from "../../../convex-dev/runtimeGatewayBackend";
import type { Id } from "../../../convex-dev/_generated/dataModel";
import { getFunctionName } from "convex/server";
import { convexToJson, type Value } from "convex/values";
import { FACTS_JSON_SCHEMA } from "../../../src/domain/extraction";
import { CONFLICT_DECISION_JSON_SCHEMA } from "../../../src/domain/conflicts";
import { canonicalModelJson, DEFAULT_CHAT_MODEL_ID, resolveModelPolicy } from "../../../src/domain/model-policy";
import type { TrustedModelQualification } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "../../../src/domain/profile";
import { extractSourceFacts, prepareSourceContent } from "../../../src/domain/sources";

const chatFactory = jest.fn<(id: string) => LanguageModelV4>();
const embeddingFactory = jest.fn<(id: string) => EmbeddingModelV4>();
jest.unstable_mockModule("@convex-dev/ai-sdk-provider", () => ({
  convexGateway: Object.assign(chatFactory, { embeddingModel: embeddingFactory }),
}));
const actualGateway = await import("../../../convex-dev/runtimeGateway");
const handles: { binding: GatewayBinding; lifecycle: GatewayLifecycle; complete: ReturnType<typeof jest.fn<() => Promise<void>>> }[] = [];
const governedFactory = jest.fn<typeof actualGateway.createGovernedGatewayModel>(async (composition, binding) => {
  const result = await actualGateway.createGovernedGatewayModel(composition, binding);
  const complete = jest.fn<() => Promise<void>>(() => result.lifecycle.complete());
  const lifecycle = { ...result.lifecycle, complete };
  handles.push({ binding, lifecycle, complete });
  return { ...result, lifecycle };
});
jest.unstable_mockModule("../../../convex-dev/runtimeGateway", () => ({
  ...actualGateway, createGovernedGatewayModel: governedFactory,
}));
const backendComposition = jest.fn<typeof import("../../../convex-dev/runtimeGatewayBackend").createBackendGatewayComposition>();
const ensureBudget = jest.fn<typeof import("../../../convex-dev/runtimeGatewayBackend").ensureBackendGatewayBudget>();
// Retain the actual RPC composer for the domain-to-native contract regression.
const actualBackend = await import("../../../convex-dev/runtimeGatewayBackend");
jest.unstable_mockModule("../../../convex-dev/runtimeGatewayBackend", () => ({
  createBackendGatewayComposition: backendComposition, ensureBackendGatewayBudget: ensureBudget,
}));
const { createGatewayMemoryModel } = await import("../../../convex-dev/runtimeMemoryGateway");
// The ingestion ledger imports the memory adapter. Install controlled backend ports
// before that ledger import; the strict native exportArgs checks below stay real.
const nativePolicy = await import("../../../convex-dev/runtimeModelPolicy");

const reference = { tenantId: "tenant-a", tenantEpoch: 2, memorySpaceId: "space-a", memorySpaceEpoch: 3,
  principalId: "principal-a", principalVersion: 4, membershipId: "member-a", membershipVersion: 5,
  grantId: "grant-a", grantVersion: 6 };
const sourceReference = { sourceId: "source-a", sourceEventId: "event-a", sourceRevision: 1 };
const witnessHash = "b".repeat(64);
const source: SourceContent = { tenantId: reference.tenantId, memorySpaceId: reference.memorySpaceId,
  ownerPrincipalId: reference.principalId, lineage: { ...sourceReference, role: "user", trust: "user_assertion" },
  content: "User likes tea", contentHash: witnessHash, createdAt: 1000 };
const extracted = { facts: [{ fact: "User likes tea", factType: "preference", subject: "user", predicate: "likes", object: "tea",
  confidence: 0.9, tags: [], entities: [], relations: [] }] };
const decision = { action: "ADD", targetFactId: null, reason: "New preference", mergedFact: null, confidence: 90 };
const operation = { operationId: "logical-operation-a", policyVersion: "memory-policy-v1", attempt: 1 };
const extractRequest = (): Parameters<MemoryModel["extract"]>[0] => ({ ...operation, source: { ...sourceReference },
  purpose: "memory.extract", system: "Extract facts as JSON.", prompt: "User likes tea", schema: FACTS_JSON_SCHEMA });
const resolveRequest = (): Parameters<MemoryModel["resolve"]>[0] => ({ ...operation, source: { ...sourceReference },
  purpose: "facts.resolve", system: "Resolve conflicts as JSON.", prompt: "Compare tea preference", candidate: { fact: "User likes tea", confidence: 0.9 } });
const embedRequest = (purpose: "embedding.memory" | "embedding.query" = "embedding.memory", texts = ["User likes tea"]): Parameters<MemoryModel["embed"]>[0] => ({
  ...operation, ...(purpose === "embedding.memory" ? { source: { ...sourceReference } } : {}), purpose, profile: DEFAULT_EMBEDDING_PROFILE, texts,
});
const vector = (value = 0.25): number[] => Array.from({ length: DEFAULT_EMBEDDING_PROFILE.dimensions }, () => value);
// The backend composition is mocked, so ctx is only an identity passed to those ports.
const ctx = Object.freeze({}) as BackendGatewayContext;

/** The native registrations are authoritative for this strictly smaller source wire shape.
 * No attribution stripping happens here: an extra role/trust/operationId must fail. */
function assertNativeModelSource(registration: unknown, args: unknown): void {
  const schema = JSON.parse((registration as { exportArgs(): string }).exportArgs()) as {
    value: { source: { fieldType: { type: string; value: Record<string, { fieldType: { type: string }; optional: boolean }> } } };
  };
  const sourceSchema = schema.value.source.fieldType;
  expect(sourceSchema.type).toBe("object");
  expect(Object.keys(sourceSchema.value).sort()).toEqual(["contentHash", "sourceEventId", "sourceId", "sourceRevision"]);
  const wire = convexToJson(args as Value) as { source?: Record<string, unknown> };
  if (!wire.source || typeof wire.source !== "object" || Array.isArray(wire.source)) throw new Error("Native model source required");
  const extra = Object.keys(wire.source).filter((key) => !Object.hasOwn(sourceSchema.value, key));
  if (extra.length) throw new Error(`Unknown native source fields: ${extra.sort().join(",")}`);
  for (const [key, field] of Object.entries(sourceSchema.value)) {
    if (!Object.hasOwn(wire.source, key) && !field.optional) throw new Error(`Missing native source field: ${key}`);
    if (Object.hasOwn(wire.source, key) && typeof wire.source[key] !== field.fieldType.type) throw new Error(`Invalid native source field: ${key}`);
  }
}

function resolution(binding: GatewayBinding, policyCap: number, evidenceCap: number, allowFallback = false, inputCap = 10000): GatewayResolution {
  const embedding = binding.operationKey.startsWith("embedding.");
  const modelId = embedding ? DEFAULT_EMBEDDING_PROFILE.modelId : DEFAULT_CHAT_MODEL_ID;
  const nativeInterface = embedding ? "embedding" as const : "chat" as const;
  const capabilities = embedding ? ["embedding" as const] : ["text" as const, "structured" as const];
  const pins = { promptVersion: "p1", schemaVersion: binding.operationKey === "memory.extract" ? "facts-v1"
    : binding.operationKey === "facts.resolve" ? "conflicts-v1" : "s1", extractionVersion: "e1", toolRegistryVersion: "t1", priceRevision: "fixture-price", boundRevision: "fixture-bound" };
  const limits = { inputTokens: inputCap, contextTokens: 11000, outputTokens: policyCap, toolSteps: 0, timeoutMs: 1000,
    operationBudgetUnits: 10000, runBudgetUnits: 100000, tenantBudgetUnits: 100000, concurrency: 4 };
  const fallbackModels = allowFallback && !embedding ? ["openai/gpt-4o"] : [];
  const qualifications: TrustedModelQualification[] = [modelId, ...fallbackModels].map((id, index) => ({
    receiptId: index === 0 ? "offline-only" : "offline-fallback", modelId: id, nativeInterface, capabilities, allowedOptions: [], limits,
    costBound: { kind: "qualified-call-ceiling", maximumCostUnits: 100, provenance: "OFFLINE-FIXTURE-NOT-PRICE-EVIDENCE", coversAllProviderCharges: true },
    priceRevision: pins.priceRevision, boundRevision: pins.boundRevision,
  }));
  const snapshot = resolveModelPolicy({ context: { scope: reference, operationKey: binding.operationKey, runBudgetId: binding.runBudgetId,
    authorizedOverrides: [], ...(embedding ? { semanticProfile: DEFAULT_EMBEDDING_PROFILE } : {}),
    ...(binding.parentOperationId ? { parentOperationId: binding.parentOperationId } : {}),
    ...(binding.source ? { source: { sourceId: binding.source.sourceId, sourceEventId: binding.source.sourceEventId, sourceRevision: binding.source.sourceRevision } } : {}) },
    policies: [{ policyId: "fixture", version: 1, scope: "deployment", rules: { modelId, nativeInterface, allowedModels: [modelId, ...fallbackModels],
      interfaces: [nativeInterface], capabilities, allowedOptions: [], allowedTools: [], fallbackModels, limits, pins } }], qualifications });
  const hash = "a".repeat(64);
  return { snapshot, storageLimits: { canonicalBytes: 180000, privateResultBytes: 60000, embeddingValuesPerCall: 1 },
    dispatchEvidence: { receiptId: "offline-only", modelId, nativeInterface, evidenceHash: hash, providerVersion: "0.2.1",
      priceRevision: pins.priceRevision, boundRevision: pins.boundRevision, checkedAt: 0, expiresAt: 100000,
      terminalCost: "gateway-aggregate-usd-v1", terminalProof: "provider-terminal-v1",
      inputBound: { ruleId: embedding ? "default-embedding-utf8-v1" : "plain-chat-cookbook-utf8-v1",
        featureEnvelope: embedding ? "default-embedding-v1" : "plain-chat-v1", revision: 1, proofHash: hash, documentHash: hash, nativeTransformHash: hash },
      resultBound: { maximumPrivateResultBytes: 60000, maximumOutputTokens: evidenceCap, maximumEmbeddingValues: 1, proofHash: hash } } };
}

function fixture(allowFallback = false) {
  const recheckAuthority = jest.fn<MemoryRepository["recheckAuthority"]>().mockResolvedValue(undefined);
  const getSource = jest.fn<MemoryRepository["getSource"]>().mockResolvedValue(structuredClone(source));
  const scopeWithMetadata = { ...reference, actorKind: "user", capabilities: ["read", "write"], resourceAccess: "own", userId: "untrusted-extra" };
  const repository: MemoryRepository = { scope: scopeWithMetadata,
    recheckAuthority, getSource,
    putSource: async () => { throw new Error("Unexpected persistence"); }, commitDerived: async () => { throw new Error("Unexpected commit"); },
    searchVectors: async () => { throw new Error("Unexpected search"); }, listFacts: async () => { throw new Error("Unexpected fact read"); },
  };
  const admissions: (GatewayBinding & { requestCanonical: string })[] = [];
  const chatCalls: LanguageModelV4CallOptions[] = [];
  const embeddingCalls: Parameters<EmbeddingModelV4["doEmbed"]>[0][] = [];
  let policyCap = 64; let evidenceCap = 64; let inputCap = 10000;
  let replay: unknown; let replayEnabled = false; let admissionFailure: Error | undefined;
  let nativeFailure: Error | undefined; let text = JSON.stringify(extracted); let vectors = [vector()];
  let afterNative: (() => void) | undefined;
  let admittedId: ((binding: GatewayBinding) => Id<"runtimeModelOperations">) | undefined;
  const resolved = jest.fn<GatewayComposition["ledger"]["resolve"]>(async (binding) => resolution(binding as GatewayBinding, policyCap, evidenceCap, allowFallback, inputCap));
  const checkpoint = jest.fn<GatewayComposition["ledger"]["checkpoint"]>(async (args) => ({ dispatchPermit: true,
    dispatchIdentity: `dispatch-${admissions.length}`, snapshot: resolution(admissions.at(-1)!, policyCap, evidenceCap, allowFallback, inputCap).snapshot, requestCanonical: args.requestCanonical }));
  const capture = jest.fn<GatewayComposition["terminalSink"]["capture"]>().mockResolvedValue({ evidenceId: "durable-offline-fixture" });
  const attach = jest.fn<GatewayComposition["ledger"]["attachTerminalResult"]>().mockResolvedValue({ attached: true, resultWithheld: false });
  const composition: GatewayComposition = { now: () => 1000, terminalSink: { capture }, ledger: {
    resolve: resolved,
    admit: async (args) => {
      admissions.push(args);
      if (admissionFailure) throw admissionFailure;
      const operationId = admittedId?.(args) ?? `admitted-${args.operationKey}-${args.ordinal}` as Id<"runtimeModelOperations">;
      if (replayEnabled) return { status: "replay", operationId, resultCanonical: canonicalModelJson(replay) };
      return { status: "reserved", operationId, attemptId: `attempt-${admissions.length}` as Id<"runtimeModelAttempts">,
        snapshot: resolution(args, policyCap, evidenceCap, allowFallback, inputCap).snapshot, requestCanonical: args.requestCanonical };
    },
    checkpoint, markVisible: async () => ({ recorded: true }), attachTerminalResult: attach,
  } };
  const language: LanguageModelV4 = { specificationVersion: "v4", modelId: DEFAULT_CHAT_MODEL_ID, provider: "convexGateway.chat", supportedUrls: {},
    doGenerate: async (input) => {
      chatCalls.push(input); if (nativeFailure) throw nativeFailure; afterNative?.();
      const result: LanguageModelV4GenerateResult = { content: [{ type: "text", text }, { type: "reasoning", text: "PRIVATE_REASONING" }],
        finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [],
        response: { body: { id: "offline-chat", model: DEFAULT_CHAT_MODEL_ID, choices: [{ finish_reason: "stop" }],
          usage: { prompt_tokens: 1, completion_tokens: 1, cost: "0" } } } };
      return result;
    }, doStream: async () => { throw new Error("Memory adapter must not open a chat stream"); },
  };
  const embedding: EmbeddingModelV4 = { specificationVersion: "v4", modelId: DEFAULT_EMBEDDING_PROFILE.modelId,
    provider: "convexGateway.embedding", maxEmbeddingsPerCall: 100, supportsParallelCalls: true,
    doEmbed: async (input) => { embeddingCalls.push(input); if (nativeFailure) throw nativeFailure; afterNative?.();
      return { embeddings: vectors, warnings: [], response: { body: { id: "offline-embedding", model: DEFAULT_EMBEDDING_PROFILE.modelId,
        data: vectors.map((embedding) => ({ embedding })), usage: { prompt_tokens: 1, cost: "0" } } } }; },
  };
  backendComposition.mockReturnValue(composition);
  ensureBudget.mockResolvedValue({ runBudgetId: "shared-run-budget", runAccountId: "run-account" as Id<"runtimeBudgetAccounts"> });
  chatFactory.mockReturnValue(language); embeddingFactory.mockReturnValue(embedding);
  return { repository, recheckAuthority, getSource, composition, resolved, checkpoint, capture, attach, admissions, chatCalls, embeddingCalls, language,
    text: (value: string) => { text = value; }, vectors: (value: number[][]) => { vectors = value; },
    replay: (value: unknown) => { replayEnabled = true; replay = value; },
    stopReplay: () => { replayEnabled = false; },
    admittedId: (identity: (binding: GatewayBinding) => Id<"runtimeModelOperations">) => { admittedId = identity; },
    failNative: () => { nativeFailure = new Error("Ambiguous dispatched outcome"); },
    failAdmission: () => { admissionFailure = new Error("Authority revoked before checkpoint"); },
    caps: (policy: number, evidence: number) => { policyCap = policy; evidenceCap = evidence; },
    inputCap: (value: number) => { inputCap = value; },
    afterNative: (callback: () => void) => { afterNative = callback; },
  };
}

beforeEach(() => { handles.length = 0; jest.clearAllMocks(); });
afterEach(() => {
  for (const handle of handles) {
    expect(handle.complete).toHaveBeenCalledTimes(1);
    expect(handle.lifecycle.pendingWork()).toEqual({ authority: 0, capture: 0, settlement: 0, native: 0, reader: 0, cleanup: 0 });
  }
});

describe("governed backend memory adapter (offline)", () => {
  it.each(["user", "tool"] as const)("projects actual %s extraction lineage through strict native resolve/admit and preserves embedding parent", async (role) => {
    const f = fixture();
    const lineage = role === "user" ? source.lineage : { ...sourceReference, role: "tool" as const,
      trust: "verified_tool_evidence" as const, operationId: "registered-tool-operation" };
    const prepared = await prepareSourceContent(f.repository.scope, lineage, source.content, { now: () => 1000 });
    f.getSource.mockResolvedValue(prepared.source);
    const rpc: { name: string; args: unknown }[] = [];
    const nativeCtx = {
      runQuery: async (ref: unknown, args: unknown) => {
        const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]); rpc.push({ name, args });
        if (name !== "runtimeModelPolicy:resolve") throw new Error("Unexpected native query");
        assertNativeModelSource(nativePolicy.resolve, args);
        return await f.resolved(args as Parameters<typeof f.resolved>[0]);
      },
      runMutation: async (ref: unknown, args: unknown) => {
        const name = getFunctionName(ref as Parameters<typeof getFunctionName>[0]); rpc.push({ name, args });
        if (name === "runtimeModelPolicy:admit") {
          assertNativeModelSource(nativePolicy.admit, args);
          return await f.composition.ledger.admit(args as Parameters<typeof f.composition.ledger.admit>[0]);
        }
        if (name === "runtimeModelPolicy:checkpoint") return await f.checkpoint(args as Parameters<typeof f.checkpoint>[0]);
        if (name === "runtimeModelPolicy:markVisible") return { recorded: true };
        if (name === "runtimeModelPolicy:captureTerminalEvidence") return await f.capture(args as Parameters<typeof f.capture>[0]);
        if (name === "runtimeModelPolicy:attachTerminalResult") return await f.attach(args as Parameters<typeof f.attach>[0]);
        throw new Error("Unexpected native mutation");
      },
    } as BackendGatewayContext;
    // Use the same offline evidence clock as the original fixture; RPC assembly stays actual.
    backendComposition.mockReturnValue({ ...actualBackend.createBackendGatewayComposition(nativeCtx), now: f.composition.now });
    const model = createGatewayMemoryModel(nativeCtx, f.repository, { runBudgetId: "domain-run" });
    const extract = jest.spyOn(model, "extract");
    // The domain function really forwards all lineage fields; the adapter alone projects the RPC.
    expect(await extractSourceFacts(prepared.source, model, operation)).toEqual([
      { ...extracted.facts[0], entities: undefined, relations: undefined, lineage },
    ]); // The real domain parser omits empty entity/relation collections.
    expect(extract.mock.calls[0]![0].source).toEqual(lineage);
    expect(extract.mock.calls[0]![0].source).toHaveProperty("role", role);
    await model.embed({ ...embedRequest(), source: lineage });
    const expectedSource = { ...sourceReference, contentHash: prepared.source.contentHash };
    const sourceCalls = rpc.filter((call) => ["runtimeModelPolicy:resolve", "runtimeModelPolicy:admit"].includes(call.name));
    expect(sourceCalls.length).toBeGreaterThanOrEqual(4);
    for (const call of sourceCalls) {
      expect((call.args as { source: unknown }).source).toEqual(expectedSource);
      expect(Object.keys((call.args as { source: object }).source).sort()).toEqual(["contentHash", "sourceEventId", "sourceId", "sourceRevision"]);
    }
    expect(f.admissions.map((a) => [a.operationKey, a.parentOperationId ?? null, a.source])).toEqual([
      ["memory.extract", null, expectedSource], ["embedding.memory", "admitted-memory.extract-0", expectedSource],
    ]);
    expect(f.chatCalls).toHaveLength(1); expect(f.embeddingCalls).toHaveLength(1); expect(ensureBudget).not.toHaveBeenCalled();
    // Prove that the installed source schema would reject the exact former spread payload.
    for (const registration of [nativePolicy.resolve, nativePolicy.admit]) {
      expect(() => assertNativeModelSource(registration, { source: { ...lineage, contentHash: prepared.source.contentHash } }))
        .toThrow("Unknown native source fields");
    }
  });

  it("constructs lazily, then passes only the trusted ten-field reference and current source witness", async () => {
    const f = fixture(); const model = createGatewayMemoryModel(ctx, f.repository);
    expect(ensureBudget).not.toHaveBeenCalled(); expect(governedFactory).not.toHaveBeenCalled();
    expect(await model.extract(extractRequest())).toEqual(extracted);
    const requestId = await semanticHash(canonicalModelJson(["memory.extract", operation.operationId, operation.policyVersion]));
    expect(ensureBudget).toHaveBeenCalledWith(ctx, { reference, operationKey: "memory.extract", requestId, requestCanonical: canonicalModelJson(extractRequest()) });
    expect(f.admissions[0]).toMatchObject({ reference, source: { ...sourceReference, contentHash: witnessHash }, ordinal: 0 });
    expect(Object.keys(f.admissions[0]!.reference).sort()).toEqual(Object.keys(reference).sort());
    expect(f.getSource).toHaveBeenCalledWith(sourceReference.sourceId);
    expect(f.chatCalls[0]!.prompt).toEqual([{ role: "system", content: `Extract facts as JSON.\n\nReturn ONLY a JSON object conforming to this schema. Do not use Markdown fences or add other fields:\n${canonicalModelJson(FACTS_JSON_SCHEMA)}` },
      { role: "user", content: [{ type: "text", text: "User likes tea" }] }]);
    expect(f.chatCalls[0]!.abortSignal).toBe(handles[0]!.lifecycle.signal);
    expect(JSON.stringify(extracted)).not.toContain("PRIVATE_REASONING");
  });

  it("routes extraction, conflict, memory and query embeddings through one budget with admitted parent and per-value ordinals", async () => {
    const f = fixture(); const model = createGatewayMemoryModel(ctx, f.repository);
    await model.extract(extractRequest()); f.text(JSON.stringify(decision));
    expect(await model.resolve(resolveRequest())).toEqual(decision);
    const memory = await model.embed(embedRequest("embedding.memory", ["first", "second"]));
    const query = await model.embed(embedRequest("embedding.query", ["query"]));
    expect(memory).toEqual({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: [vector(), vector()] });
    expect(query).toEqual({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: [vector()] });
    expect(ensureBudget).toHaveBeenCalledTimes(1);
    expect(f.admissions.map((a) => [a.operationKey, a.ordinal, a.parentOperationId ?? null, a.runBudgetId])).toEqual([
      ["memory.extract", 0, null, "shared-run-budget"], ["facts.resolve", 0, "admitted-memory.extract-0", "shared-run-budget"],
      ["embedding.memory", 0, "admitted-memory.extract-0", "shared-run-budget"], ["embedding.memory", 1, "admitted-memory.extract-0", "shared-run-budget"],
      ["embedding.query", 0, null, "shared-run-budget"],
    ]);
    expect(f.embeddingCalls.map((a) => a.values)).toEqual([["first"], ["second"], ["query"]]);
    expect(f.admissions.slice(2, 4).map((a) => a.semanticId)).toEqual([f.admissions[2]!.semanticId, f.admissions[2]!.semanticId]);
    expect(f.admissions[4]!.semanticId).not.toBe(f.admissions[2]!.semanticId);
    expect(f.admissions[4]).not.toHaveProperty("source");
    expect(JSON.parse(f.admissions[0]!.requestCanonical).outputSchema).toEqual(FACTS_JSON_SCHEMA);
    expect(JSON.parse(f.admissions[1]!.requestCanonical).outputSchema).toEqual(CONFLICT_DECISION_JSON_SCHEMA);
    for (const [index, request, schema] of [[0, extractRequest(), FACTS_JSON_SCHEMA], [1, resolveRequest(), CONFLICT_DECISION_JSON_SCHEMA]] as const) {
      const system = `${request.system}\n\nReturn ONLY a JSON object conforming to this schema. Do not use Markdown fences or add other fields:\n${canonicalModelJson(schema)}`;
      expect(f.chatCalls[index]!.prompt).toEqual([{ role: "system", content: system },
        { role: "user", content: [{ type: "text", text: request.prompt }] }]);
      const admitted = JSON.parse(f.admissions[index]!.requestCanonical) as { texts: string[]; inputTokens: number; messages: unknown };
      expect(admitted.texts).toEqual([system, request.prompt]);
      expect(admitted.messages).toEqual([{ role: "system", parts: [{ type: "text", text: system }] },
        { role: "user", parts: [{ type: "text", text: request.prompt }] }]);
      // Qualified plain-chat bound is one unit per actual UTF8 byte plus framing.
      expect(admitted.inputTokens).toBeGreaterThanOrEqual(Buffer.byteLength(system + request.prompt, "utf8"));
      expect(admitted.inputTokens).toBeGreaterThan(Buffer.byteLength(request.system + request.prompt, "utf8") + Buffer.byteLength(canonicalModelJson(schema), "utf8"));
    }
    for (const admission of f.admissions.slice(2)) expect(JSON.parse(admission.requestCanonical)).not.toHaveProperty("outputSchema");
    for (const call of f.chatCalls) expect(call.responseFormat).toBeUndefined(); // schemas are trusted ledger semantics; the native interface remains plain chat
    for (const admission of f.admissions) expect(JSON.parse(admission.requestCanonical)).toMatchObject({ options: { maxRetries: 0 }, tools: [], toolSteps: 0 });
  });

  it.each(["extract", "resolve"] as const)("charges the full trusted %s schema to preflight input limits before admission/dispatch", async (method) => {
    const f = fixture(); const request = method === "extract" ? extractRequest() : resolveRequest();
    // This policy permits the old prompt/framing but cannot fit the new schema instruction.
    f.inputCap(Buffer.byteLength(request.system + request.prompt, "utf8") + 19);
    const model = createGatewayMemoryModel(ctx, f.repository, { runBudgetId: "schema-bound-run" });
    const call = method === "extract" ? model.extract(request as ReturnType<typeof extractRequest>) : model.resolve(request as ReturnType<typeof resolveRequest>);
    await expect(call).rejects.toThrow("request exceeds bounded limits");
    expect(f.admissions).toEqual([]); expect(f.chatCalls).toEqual([]); expect(f.capture).not.toHaveBeenCalled();
    expect(ensureBudget).not.toHaveBeenCalled(); expect(handles).toHaveLength(1);
  });

  it("reuses a server-issued run and parent without allocating a separate budget", async () => {
    const f = fixture(); const parent = "upstream-operation" as Id<"runtimeModelOperations">;
    const model = createGatewayMemoryModel(ctx, f.repository, { runBudgetId: "upstream-run", parentOperationId: parent });
    await model.extract(extractRequest()); await model.embed(embedRequest());
    expect(ensureBudget).not.toHaveBeenCalled();
    expect(f.admissions.map((a) => [a.runBudgetId, a.parentOperationId])).toEqual([["upstream-run", parent], ["upstream-run", "admitted-memory.extract-0"]]);
  });

  it.each(["fresh", "replay"])("correlates multiple %s extractions with their own embedding and conflict parents", async (kind) => {
    const f = fixture(); const second = { sourceId: "source-b", sourceEventId: "event-b", sourceRevision: 1 };
    f.getSource.mockImplementation(async (sourceId) => ({ ...source, lineage: { ...source.lineage,
      ...(sourceId === second.sourceId ? second : sourceReference) } }));
    f.admittedId((binding) => `${binding.operationKey}-${binding.source?.sourceId ?? "query"}-${binding.ordinal}` as Id<"runtimeModelOperations">);
    if (kind === "replay") f.replay({ text: JSON.stringify(extracted) });
    const model = createGatewayMemoryModel(ctx, f.repository);
    await model.extract(extractRequest());
    await model.extract({ ...extractRequest(), operationId: "extract-b", source: second });
    f.stopReplay();
    await model.embed(embedRequest("embedding.memory", ["first a", "second a"]));
    await model.embed({ ...embedRequest(), operationId: "embed-b", source: second });
    f.text(JSON.stringify(decision)); await model.resolve(resolveRequest());
    await model.embed(embedRequest("embedding.query"));
    expect(f.admissions.slice(2).map((a) => [a.operationKey, a.source?.sourceId ?? null, a.ordinal, a.parentOperationId ?? null])).toEqual([
      ["embedding.memory", "source-a", 0, "memory.extract-source-a-0"],
      ["embedding.memory", "source-a", 1, "memory.extract-source-a-0"],
      ["embedding.memory", "source-b", 0, "memory.extract-source-b-0"],
      ["facts.resolve", "source-a", 0, "memory.extract-source-a-0"],
      ["embedding.query", null, 0, null],
    ]);
    expect(new Set(f.admissions.map((a) => a.runBudgetId))).toEqual(new Set(["shared-run-budget"]));
    expect(ensureBudget).toHaveBeenCalledTimes(1);
    expect(f.chatCalls).toHaveLength(kind === "replay" ? 1 : 3);
  });

  it.each(["sourceId", "sourceEventId", "sourceRevision"] as const)("never borrows an unrelated extraction parent when only %s differs", async (field) => {
    const f = fixture(); const parent = "upstream-operation" as Id<"runtimeModelOperations">;
    const model = createGatewayMemoryModel(ctx, f.repository, { parentOperationId: parent });
    await model.extract(extractRequest());
    const changed = { ...sourceReference, [field]: field === "sourceRevision" ? 2 : "new-source-part" };
    f.getSource.mockResolvedValue({ ...source, lineage: { ...source.lineage, ...changed } });
    await model.embed({ ...embedRequest(), operationId: "unextracted-tuple", source: changed });
    await model.embed(embedRequest("embedding.query"));
    expect(f.admissions.slice(1).map((a) => a.parentOperationId)).toEqual([parent, parent]);
    expect(f.admissions[1]!.source).toMatchObject(changed);
    expect(f.embeddingCalls).toHaveLength(2);
  });

  it("joins concurrent first uses of the same lazy run budget", async () => {
    const f = fixture(); let release!: () => void;
    const pending = new Promise<void>((resolve) => { release = resolve; });
    ensureBudget.mockImplementation(async () => { await pending; return { runBudgetId: "one-run", runAccountId: "run-account" as Id<"runtimeBudgetAccounts"> }; });
    const model = createGatewayMemoryModel(ctx, f.repository);
    const first = model.embed(embedRequest("embedding.query", ["first query"]));
    const second = model.embed({ ...embedRequest("embedding.query", ["second query"]), operationId: "second-logical-operation" });
    // Let both source checks/hash promises reach the shared budget, without timers.
    await new Promise<void>((resolve) => setImmediate(resolve)); release();
    await Promise.all([first, second]);
    expect(ensureBudget).toHaveBeenCalledTimes(1); expect(f.admissions.map((a) => a.runBudgetId)).toEqual(["one-run", "one-run"]);
    expect(new Set(f.admissions.map((a) => a.semanticId)).size).toBe(2);
  });

  it.each([[32, 64, 32], [64, 16, 16]])("uses the smaller trusted policy/evidence output cap (%i/%i)", async (policy, evidence, expected) => {
    const f = fixture(); f.caps(policy, evidence); await createGatewayMemoryModel(ctx, f.repository).extract(extractRequest());
    expect(f.chatCalls[0]!.maxOutputTokens).toBe(expected);
    expect(JSON.parse(f.admissions[0]!.requestCanonical).outputTokens).toBe(expected);
  });

  it("withholds a text call if the current factory resolution tightened the adapter's earlier cap", async () => {
    const f = fixture();
    f.resolved.mockImplementationOnce(async (binding) => resolution(binding as GatewayBinding, 64, 64));
    f.caps(16, 16);
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toMatchObject({ code: "OUTPUT_BOUND_EXCEEDED" });
    expect(f.admissions).toEqual([]); expect(f.chatCalls).toEqual([]); expect(handles).toHaveLength(1);
  });

  it("rejects a schema change before authority, budget or model construction", async () => {
    const f = fixture(); const request = extractRequest();
    request.schema = { ...FACTS_JSON_SCHEMA, additionalProperties: true } as unknown as typeof FACTS_JSON_SCHEMA;
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(request)).rejects.toThrow("Extraction schema");
    expect(f.recheckAuthority).not.toHaveBeenCalled(); expect(ensureBudget).not.toHaveBeenCalled(); expect(governedFactory).not.toHaveBeenCalled();
  });

  it.each(["extract", "resolve", "embed"] as const)("denies an automatic %s attempt before creating a new reservation", async (method) => {
    const f = fixture(); const model = createGatewayMemoryModel(ctx, f.repository);
    const outcome = method === "extract" ? model.extract({ ...extractRequest(), attempt: 2 })
      : method === "resolve" ? model.resolve({ ...resolveRequest(), attempt: 2 }) : model.embed({ ...embedRequest(), attempt: 2 });
    await expect(outcome).rejects.toThrow("retries require a new governed operation");
    expect(ensureBudget).not.toHaveBeenCalled(); expect(f.admissions).toEqual([]); expect(f.recheckAuthority).not.toHaveBeenCalled();
  });

  it.each(["missing", "event", "revision"])("rejects a %s source witness before budget or dispatch", async (kind) => {
    const f = fixture(); const changed = structuredClone(source);
    if (kind === "event") changed.lineage.sourceEventId = "replacement-event";
    if (kind === "revision") changed.lineage.sourceRevision++;
    f.getSource.mockResolvedValue(kind === "missing" ? null : changed);
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toThrow("Source changed");
    expect(ensureBudget).not.toHaveBeenCalled(); expect(governedFactory).not.toHaveBeenCalled(); expect(f.chatCalls).toEqual([]);
  });

  it("denies revoked authority before allocating a budget", async () => {
    const f = fixture(); f.recheckAuthority.mockRejectedValue(new Error("REVOKED"));
    await expect(createGatewayMemoryModel(ctx, f.repository).embed(embedRequest())).rejects.toThrow("REVOKED");
    expect(f.getSource).not.toHaveBeenCalled(); expect(ensureBudget).not.toHaveBeenCalled(); expect(embeddingFactory).not.toHaveBeenCalled();
  });

  it.each(["revocation", "source-change"])("rechecks %s before the second embedding value and stops with no second dispatch", async (kind) => {
    const f = fixture(); f.afterNative(() => {
      if (kind === "revocation") f.recheckAuthority.mockRejectedValue(new Error("REVOKED"));
      else f.getSource.mockResolvedValue({ ...source, lineage: { ...source.lineage, sourceRevision: 2 } });
    });
    await expect(createGatewayMemoryModel(ctx, f.repository).embed(embedRequest("embedding.memory", ["first", "second"]))).rejects.toThrow(kind === "revocation" ? "REVOKED" : "Source changed");
    expect(f.embeddingCalls).toHaveLength(1); expect(f.admissions).toHaveLength(1); expect(handles).toHaveLength(1);
  });

  it("lets current native admission deny a grant revoked after the repository precheck", async () => {
    const f = fixture(); f.failAdmission();
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toThrow("Authority revoked");
    expect(f.recheckAuthority).toHaveBeenCalledTimes(1); expect(f.chatCalls).toEqual([]); expect(f.checkpoint).not.toHaveBeenCalled();
  });

  it("does not retry a failed lazy budget allocation or fall back to a model", async () => {
    const f = fixture(); ensureBudget.mockRejectedValue(new Error("BUDGET_DENIED"));
    const model = createGatewayMemoryModel(ctx, f.repository);
    await expect(model.extract(extractRequest())).rejects.toThrow("BUDGET_DENIED");
    await expect(model.embed(embedRequest("embedding.query"))).rejects.toThrow("BUDGET_DENIED");
    expect(ensureBudget).toHaveBeenCalledTimes(1); expect(governedFactory).not.toHaveBeenCalled(); expect(f.admissions).toEqual([]);
  });

  it.each(["extract", "embed"] as const)("joins lifecycle after an ambiguous %s failure without another native call or fallback", async (method) => {
    const f = fixture(); f.failNative(); const model = createGatewayMemoryModel(ctx, f.repository);
    await expect(method === "extract" ? model.extract(extractRequest()) : model.embed(embedRequest("embedding.memory", ["first", "second"])))
      .rejects.toMatchObject({ code: "MODEL_INTERRUPTED" });
    expect(f.chatCalls.length + f.embeddingCalls.length).toBe(1); expect(f.admissions).toHaveLength(1);
    expect(f.capture).not.toHaveBeenCalled(); expect(f.attach).not.toHaveBeenCalled();
  });

  it("does not automatically dispatch a policy-qualified fallback after ambiguous extraction", async () => {
    const f = fixture(true); f.failNative();
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toMatchObject({ code: "MODEL_INTERRUPTED" });
    expect((await f.resolved(f.admissions[0]!)).snapshot.fallbackCandidates).toEqual([{ modelId: "openai/gpt-4o", qualificationReceiptId: "offline-fallback" }]);
    expect(chatFactory.mock.calls).toEqual([[DEFAULT_CHAT_MODEL_ID]]); expect(f.admissions).toHaveLength(1); expect(f.chatCalls).toHaveLength(1);
  });

  it.each(["not JSON", "   "])("rejects unusable extraction text %j with an honest post-dispatch outcome", async (text) => {
    const f = fixture(); f.text(text);
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toMatchObject({ data: {
      version: 1, code: "INVALID_MODEL_OUTPUT", retryable: false, outcome: "uncertain",
      message: text.trim() ? "Memory extraction returned invalid JSON" : "Memory model returned no text",
    } });
    expect(f.chatCalls).toHaveLength(1); expect(handles).toHaveLength(1);
    expect(f.capture).toHaveBeenCalledTimes(1); expect(f.attach).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid conflict decision without treating it as a new fact", async () => {
    const f = fixture(); f.text('{"action":"DELETE_ALL","reason":"model claim"}');
    await expect(createGatewayMemoryModel(ctx, f.repository).resolve(resolveRequest())).rejects.toMatchObject({ data: {
      version: 1, code: "INVALID_MODEL_OUTPUT", message: "Memory conflict resolution returned invalid JSON", retryable: false, outcome: "uncertain",
    } });
    expect(f.chatCalls).toHaveLength(1); expect(handles).toHaveLength(1);
    expect(f.capture).toHaveBeenCalledTimes(1); expect(f.attach).toHaveBeenCalledTimes(1);
  });

  it.each(["empty-text", "short-vector", "nonfinite-vector"])("validates delivered %s with a safe uncertain envelope after terminal capture", async (kind) => {
    const f = fixture(); const factory = governedFactory.getMockImplementation()!;
    // Exercise the adapter's defensive post-result validation after a successful
    // governed call. The controlled factory alters delivery only; native/ledger
    // admission and terminal capture still execute once through real middleware.
    governedFactory.mockImplementationOnce(async (composition, binding) => {
      const call = await factory(composition, binding);
      if (kind === "empty-text") {
        const native = call.model as LanguageModelV4;
        return { ...call, model: { ...native, doGenerate: async (input: LanguageModelV4CallOptions) => {
          const result = await native.doGenerate(input); return { ...result, content: [{ type: "text" as const, text: "" }] };
        } } };
      }
      const native = call.model as EmbeddingModelV4;
      return { ...call, model: { ...native, doEmbed: async (input: Parameters<EmbeddingModelV4["doEmbed"]>[0]) => {
        const result = await native.doEmbed(input); return { ...result, embeddings: [kind === "short-vector" ? [0.1] : vector(NaN)] };
      } } };
    });
    const model = createGatewayMemoryModel(ctx, f.repository);
    await expect(kind === "empty-text" ? model.extract(extractRequest()) : model.embed(embedRequest("embedding.memory", ["first", "second"])))
      .rejects.toMatchObject({ data: { version: 1, code: "INVALID_MODEL_OUTPUT", retryable: false, outcome: "uncertain",
        message: kind === "empty-text" ? "Memory model returned no text" : "Memory model returned an invalid embedding" } });
    expect(f.chatCalls.length + f.embeddingCalls.length).toBe(1); expect(f.admissions).toHaveLength(1);
    expect(f.capture).toHaveBeenCalledTimes(1); expect(f.attach).toHaveBeenCalledTimes(1); expect(handles).toHaveLength(1);
  });

  it.each(["schema", "retry", "stale-source"])("retains not_dispatched for %s preflight rejection with no billable work", async (kind) => {
    const f = fixture(); const request = extractRequest();
    if (kind === "schema") request.schema = { ...FACTS_JSON_SCHEMA, additionalProperties: true } as unknown as typeof FACTS_JSON_SCHEMA;
    if (kind === "retry") request.attempt = 2;
    if (kind === "stale-source") f.getSource.mockResolvedValue(null);
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(request)).rejects.toMatchObject({ data: {
      version: 1, code: kind === "stale-source" ? "STALE_SOURCE" : "INVALID_INPUT", retryable: false, outcome: "not_dispatched",
    } });
    expect(f.chatCalls).toEqual([]); expect(f.admissions).toEqual([]); expect(f.capture).not.toHaveBeenCalled(); expect(ensureBudget).not.toHaveBeenCalled();
  });

  it("joins a failed durable terminal capture and exposes no private result", async () => {
    const f = fixture(); f.capture.mockRejectedValue(new Error("sink unavailable"));
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toMatchObject({ code: "TERMINAL_CAPTURE_PENDING" });
    expect(f.chatCalls).toHaveLength(1); expect(f.capture).toHaveBeenCalledTimes(1); expect(f.attach).not.toHaveBeenCalled();
  });

  it("uses narrow authorized extraction replay and carries its admitted parent into embedding", async () => {
    const f = fixture(); f.replay({ text: JSON.stringify(extracted) }); const model = createGatewayMemoryModel(ctx, f.repository);
    expect(await model.extract(extractRequest())).toEqual(extracted);
    f.replay({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: [vector(0.5)] });
    expect(await model.embed(embedRequest())).toEqual({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: [vector(0.5)] });
    expect(f.admissions[1]!.parentOperationId).toBe("admitted-memory.extract-0");
    expect(f.chatCalls).toEqual([]); expect(f.embeddingCalls).toEqual([]); expect(f.checkpoint).not.toHaveBeenCalled();
    expect(f.capture).not.toHaveBeenCalled(); expect(f.attach).not.toHaveBeenCalled();
    expect(f.resolved).toHaveBeenCalledTimes(6); // adapter + factory + current replay check for each operation
  });

  it("withholds previously saved text when the current replay authority check rejects", async () => {
    const f = fixture(); f.replay({ text: JSON.stringify(extracted) });
    const resolve = f.resolved.getMockImplementation()!;
    f.resolved.mockImplementation(async (binding) => {
      if (f.resolved.mock.calls.length === 3) throw new Error("REPLAY_AUTHORITY_REVOKED");
      return await resolve(binding);
    });
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toThrow("REPLAY_AUTHORITY_REVOKED");
    expect(f.admissions).toHaveLength(1); expect(f.chatCalls).toEqual([]); expect(f.capture).not.toHaveBeenCalled(); expect(handles).toHaveLength(1);
  });

  it.each([{ vectors: [vector()] }, { text: JSON.stringify(extracted), extra: true }, null])("rejects non-narrow text replay %# without inference", async (payload) => {
    const f = fixture(); f.replay(payload);
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toThrow();
    expect(f.admissions).toHaveLength(1); expect(f.resolved).toHaveBeenCalledTimes(3);
    expect(f.chatCalls).toEqual([]); expect(f.checkpoint).not.toHaveBeenCalled(); expect(handles).toHaveLength(1);
  });

  it.each(["profile", "dimension", "nonnumeric", "extra-vector", "text"])("rejects invalid %s embedding replay without inference", async (kind) => {
    const f = fixture(); const payload = kind === "text" ? { text: "pretend vector" }
      : { profile: kind === "profile" ? { ...DEFAULT_EMBEDDING_PROFILE, modelId: "openai/wrong" } : DEFAULT_EMBEDDING_PROFILE,
        vectors: kind === "dimension" ? [[0.1]] : kind === "nonnumeric" ? [Array.from({ length: DEFAULT_EMBEDDING_PROFILE.dimensions }, () => null)]
          : kind === "extra-vector" ? [vector(), vector()] : [vector()] };
    f.replay(payload);
    await expect(createGatewayMemoryModel(ctx, f.repository).embed(embedRequest("embedding.query"))).rejects.toThrow();
    expect(f.admissions).toHaveLength(1); expect(f.resolved).toHaveBeenCalledTimes(3);
    expect(f.embeddingCalls).toEqual([]); expect(f.checkpoint).not.toHaveBeenCalled(); expect(handles).toHaveLength(1);
  });

  it.each(["profileId", "modelId", "dimensions", "normalization", "chunking", "indexName"] as const)("denies mismatched requested %s before budget/dispatch", async (field) => {
    const f = fixture(); const request = embedRequest("embedding.query");
    request.profile = { ...DEFAULT_EMBEDDING_PROFILE, [field]: field === "dimensions" ? 3 : "wrong-profile-field" };
    await expect(createGatewayMemoryModel(ctx, f.repository).embed(request)).rejects.toThrow(field === "modelId" ? "CAPABILITY_UNSUPPORTED" : "PROFILE_NOT_READY");
    expect(ensureBudget).not.toHaveBeenCalled(); expect(f.recheckAuthority).not.toHaveBeenCalled(); expect(embeddingFactory).not.toHaveBeenCalled();
  });

  it.each(["dimension", "nonfinite", "empty", "extra-vector"])("withholds invalid native %s vectors, joins lifecycle and never dispatches a second value", async (kind) => {
    const f = fixture(); f.vectors(kind === "dimension" ? [[0.1]] : kind === "nonfinite" ? [vector(Infinity)] : kind === "empty" ? [] : [vector(), vector()]);
    await expect(createGatewayMemoryModel(ctx, f.repository).embed(embedRequest("embedding.memory", ["first", "second"]))).rejects.toThrow();
    expect(f.embeddingCalls).toHaveLength(1); expect(f.admissions).toHaveLength(1); expect(f.attach).not.toHaveBeenCalled(); expect(handles).toHaveLength(1);
  });

  it("rejects a factory model whose identity differs from the resolved policy before native dispatch", async () => {
    const f = fixture(); chatFactory.mockReturnValue({ ...f.language, modelId: "openai/wrong-model" });
    await expect(createGatewayMemoryModel(ctx, f.repository).extract(extractRequest())).rejects.toMatchObject({ code: "MODEL_IDENTITY_MISMATCH" });
    expect(f.admissions).toEqual([]); expect(f.chatCalls).toEqual([]); expect(handles).toEqual([]);
  });
});
