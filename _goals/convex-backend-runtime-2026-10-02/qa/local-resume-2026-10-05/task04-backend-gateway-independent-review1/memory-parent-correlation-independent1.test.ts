/** Offline adapter outcomes through the real governed V4 middleware. The official
 * factory and backend RPC ports are controlled peers, never price/service evidence. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { EmbeddingModelV4, LanguageModelV4, LanguageModelV4CallOptions, LanguageModelV4GenerateResult } from "@ai-sdk/provider";
import type { MemoryModel, MemoryRepository, SourceContent } from "../../../../../src/domain/contracts";
import type { GatewayBinding, GatewayComposition, GatewayLifecycle, GatewayResolution } from "../../../../../convex-dev/runtimeGateway";
import type { BackendGatewayContext } from "../../../../../convex-dev/runtimeGatewayBackend";
import type { Id } from "../../../../../convex-dev/_generated/dataModel";
import { FACTS_JSON_SCHEMA } from "../../../../../src/domain/extraction";
import { CONFLICT_DECISION_JSON_SCHEMA } from "../../../../../src/domain/conflicts";
import { canonicalModelJson, DEFAULT_CHAT_MODEL_ID, resolveModelPolicy } from "../../../../../src/domain/model-policy";
import type { TrustedModelQualification } from "../../../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "../../../../../src/domain/profile";

const chatFactory = jest.fn<(id: string) => LanguageModelV4>();
const embeddingFactory = jest.fn<(id: string) => EmbeddingModelV4>();
jest.unstable_mockModule("@convex-dev/ai-sdk-provider", () => ({
  convexGateway: Object.assign(chatFactory, { embeddingModel: embeddingFactory }),
}));
const actualGateway = await import("../../../../../convex-dev/runtimeGateway");
const handles: { binding: GatewayBinding; lifecycle: GatewayLifecycle; complete: ReturnType<typeof jest.fn<() => Promise<void>>> }[] = [];
const governedFactory = jest.fn<typeof actualGateway.createGovernedGatewayModel>(async (composition, binding) => {
  const result = await actualGateway.createGovernedGatewayModel(composition, binding);
  const complete = jest.fn<() => Promise<void>>(() => result.lifecycle.complete());
  const lifecycle = { ...result.lifecycle, complete };
  handles.push({ binding, lifecycle, complete });
  return { ...result, lifecycle };
});
jest.unstable_mockModule("../../../../../convex-dev/runtimeGateway", () => ({
  ...actualGateway, createGovernedGatewayModel: governedFactory,
}));
const backendComposition = jest.fn<typeof import("../../../../../convex-dev/runtimeGatewayBackend").createBackendGatewayComposition>();
const ensureBudget = jest.fn<typeof import("../../../../../convex-dev/runtimeGatewayBackend").ensureBackendGatewayBudget>();
jest.unstable_mockModule("../../../../../convex-dev/runtimeGatewayBackend", () => ({
  createBackendGatewayComposition: backendComposition, ensureBackendGatewayBudget: ensureBudget,
}));
const { createGatewayMemoryModel } = await import("../../../../../convex-dev/runtimeMemoryGateway");

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

function resolution(binding: GatewayBinding, policyCap: number, evidenceCap: number, allowFallback = false): GatewayResolution {
  const embedding = binding.operationKey.startsWith("embedding.");
  const modelId = embedding ? DEFAULT_EMBEDDING_PROFILE.modelId : DEFAULT_CHAT_MODEL_ID;
  const nativeInterface = embedding ? "embedding" as const : "chat" as const;
  const capabilities = embedding ? ["embedding" as const] : ["text" as const, "structured" as const];
  const pins = { promptVersion: "p1", schemaVersion: binding.operationKey === "memory.extract" ? "facts-v1"
    : binding.operationKey === "facts.resolve" ? "conflicts-v1" : "s1", extractionVersion: "e1", toolRegistryVersion: "t1", priceRevision: "fixture-price", boundRevision: "fixture-bound" };
  const limits = { inputTokens: 10000, contextTokens: 11000, outputTokens: policyCap, toolSteps: 0, timeoutMs: 1000,
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
    ...(binding.source ? { source: sourceReference } : {}) },
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
  let policyCap = 64; let evidenceCap = 64;
  let replay: unknown; let replayEnabled = false; let admissionFailure: Error | undefined;
  let nativeFailure: Error | undefined; let text = JSON.stringify(extracted); let vectors = [vector()];
  let afterNative: (() => void) | undefined;
  const resolved = jest.fn<GatewayComposition["ledger"]["resolve"]>(async (binding) => resolution(binding as GatewayBinding, policyCap, evidenceCap, allowFallback));
  const checkpoint = jest.fn<GatewayComposition["ledger"]["checkpoint"]>(async (args) => ({ dispatchPermit: true,
    dispatchIdentity: `dispatch-${admissions.length}`, snapshot: resolution(admissions.at(-1)!, policyCap, evidenceCap, allowFallback).snapshot, requestCanonical: args.requestCanonical }));
  const capture = jest.fn<GatewayComposition["terminalSink"]["capture"]>().mockResolvedValue({ evidenceId: "durable-offline-fixture" });
  const attach = jest.fn<GatewayComposition["ledger"]["attachTerminalResult"]>().mockResolvedValue({ attached: true, resultWithheld: false });
  const composition: GatewayComposition = { now: () => 1000, terminalSink: { capture }, ledger: {
    resolve: resolved,
    admit: async (args) => {
      admissions.push(args);
      if (admissionFailure) throw admissionFailure;
      const operationId = `admitted-${args.operationKey}-${args.ordinal}` as Id<"runtimeModelOperations">;
      if (replayEnabled) return { status: "replay", operationId, resultCanonical: canonicalModelJson(replay) };
      return { status: "reserved", operationId, attemptId: `attempt-${admissions.length}` as Id<"runtimeModelAttempts">,
        snapshot: resolution(args, policyCap, evidenceCap, allowFallback).snapshot, requestCanonical: args.requestCanonical };
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
    failNative: () => { nativeFailure = new Error("Ambiguous dispatched outcome"); },
    failAdmission: () => { admissionFailure = new Error("Authority revoked before checkpoint"); },
    caps: (policy: number, evidence: number) => { policyCap = policy; evidenceCap = evidence; },
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


// Independent regression: an exported model may execute two source operations in
// the same trusted run. Each memory embedding must keep its own extraction parent.
it("keeps each source embedding correlated with its own admitted extraction", async () => {
  const f = fixture();
  const a = { sourceId: "source-a", sourceEventId: "event-a", sourceRevision: 1 };
  const b = { sourceId: "source-b", sourceEventId: "event-b", sourceRevision: 1 };
  f.getSource.mockImplementation(async (id) => ({ ...source, lineage: { ...(id === a.sourceId ? a : b), role: "user", trust: "user_assertion" } }));
  const original = f.composition.ledger.admit;
  f.composition.ledger.admit = async (args) => {
    const admitted = await original(args);
    return { ...admitted, operationId: `admitted-${args.source?.sourceId ?? "query"}-${args.operationKey}` as Id<"runtimeModelOperations"> };
  };
  const model = createGatewayMemoryModel(ctx, f.repository);
  await model.extract({ ...extractRequest(), operationId: "extract-a", source: a });
  await model.extract({ ...extractRequest(), operationId: "extract-b", source: b });
  await model.embed({ ...embedRequest(), operationId: "embed-a", source: a });
  expect(ensureBudget).toHaveBeenCalledTimes(1);
  expect(f.admissions[2]!.source).toMatchObject(a);
  expect(f.admissions[2]!.parentOperationId).toBe("admitted-source-a-memory.extract");
});
