import { describe, expect, it } from "@jest/globals";
import {
  assertModelRequestIdentity, canFallbackModel, canonicalModelJson, createModelRequestIdentity,
  DEFAULT_CHAT_MODEL_ID, DEFAULT_EMBEDDING_PROFILE, MODEL_OPERATION_KEYS, MODEL_OPERATION_REGISTRY,
  resolveModelPolicy, validateModelRequest,
} from "../../../src/domain/index.js";
import type {
  ModelCallRequest, ModelFallbackEvidence, ModelPolicyLimits, ModelPolicyPins,
  TrustedModelPolicyContext, TrustedModelPolicyRecord, TrustedModelQualification,
} from "../../../src/domain/index.js";

const limits: ModelPolicyLimits = { inputTokens: 1000, contextTokens: 2000, outputTokens: 500, toolSteps: 3,
  timeoutMs: 10000, operationBudgetUnits: 1000, runBudgetUnits: 5000, tenantBudgetUnits: 10000, concurrency: 4 };
const pins: ModelPolicyPins = { promptVersion: "prompt-1", schemaVersion: "schema-1", extractionVersion: "extract-1",
  toolRegistryVersion: "tools-1", priceRevision: "price-1", boundRevision: "bound-1" };
const context: TrustedModelPolicyContext = { scope: { tenantId: "tenant", tenantEpoch: 1, memorySpaceId: "space", memorySpaceEpoch: 1,
  principalId: "owner", principalVersion: 1, membershipId: "member", membershipVersion: 1, grantId: "grant", grantVersion: 1 },
  agent: { agentId: "agent", version: 1 }, operationKey: "agent.respond", runBudgetId: "trusted-run", authorizedOverrides: [],
  source: { sourceId: "source", sourceEventId: "event", sourceRevision: 1 } };
const policy: TrustedModelPolicyRecord = { policyId: "deployment", version: 1, scope: "deployment", rules: {
  allowedModels: [DEFAULT_CHAT_MODEL_ID], interfaces: ["chat", "responses"], capabilities: ["text", "structured", "tools"],
  allowedOptions: ["temperature", "topP", "seed", "stopSequences"], allowedTools: ["lookup"], fallbackModels: [], limits, pins } };
const qualification: TrustedModelQualification = { receiptId: "actual-chat-receipt", modelId: DEFAULT_CHAT_MODEL_ID,
  nativeInterface: "chat", capabilities: ["text", "structured", "tools"], allowedOptions: ["temperature", "topP", "seed", "stopSequences"],
  costBound: { kind: "qualified-call-ceiling", maximumCostUnits: 500, provenance: "synthetic-bound-fixture", coversAllProviderCharges: true },
  limits, priceRevision: pins.priceRevision, boundRevision: pins.boundRevision };
const request: ModelCallRequest = { semanticId: "semantic", childCallId: "step-0", texts: [" hello\r\nworld "],
  messages: [{ role: "user", parts: [{ type: "text", text: " hello\r\nworld " }] }],
  inputTokens: 20, outputTokens: 100, toolSteps: 0, timeoutMs: 1000, reservationUnits: 500,
  promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion, extractionVersion: pins.extractionVersion,
  toolRegistryVersion: pins.toolRegistryVersion, tools: [], options: { maxRetries: 0, temperature: 0.2 } };
function base() { return JSON.parse(JSON.stringify({ context, policies: [policy], qualifications: [qualification] })) as {context: TrustedModelPolicyContext; policies: TrustedModelPolicyRecord[]; qualifications: TrustedModelQualification[]}; }
function snapshot() { return resolveModelPolicy(base()); }
// Synthetic qualifications exercise policy mechanics only; these do not qualify a second live model.
function fallbackSnapshot() {
  const input = base(); input.policies[0].rules.allowedModels?.push("fixture/alternative");
  input.policies[0].rules.fallbackModels?.push("fixture/alternative");
  input.qualifications.push({ ...qualification, modelId: "fixture/alternative", receiptId: "synthetic-alternative" });
  return resolveModelPolicy(input);
}
const safe: ModelFallbackEvidence = { outcome: "not_dispatched", proof: "pre_dispatch", outputVisible: false,
  toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false, paidLiabilityUncertain: false, cancelled: false,
  priorAttemptAccounted: true, currentAuthorityChecked: true, currentSourceChecked: true, currentPolicyChecked: true };

describe("trusted pure model policy", () => {
  it("registers every approved operation and leaves media unavailable", () => {
    expect(MODEL_OPERATION_KEYS).toHaveLength(13);
    expect(MODEL_OPERATION_REGISTRY["artifact.suggestions"].capability).toBe("text");
    for (const operationKey of ["media.image.generate", "media.video.generate"] as const) {
      expect(() => resolveModelPolicy({ ...base(), context: { ...context, operationKey } })).toThrow("CAPABILITY_UNAVAILABLE");
    }
    expect(() => resolveModelPolicy({ ...base(), context: { ...context, operationKey: "evaluationModel" } })).toThrow("INVALID_INPUT");
  });
  it("defaults to qualified gpt-4o-mini Chat and requires explicit Responses receipt", () => {
    expect(snapshot()).toMatchObject({ modelId: DEFAULT_CHAT_MODEL_ID, nativeInterface: "chat", currency: "USD", monetaryUnit: "micro-USD" });
    const input = base(); input.policies[0].rules.nativeInterface = "responses";
    expect(() => resolveModelPolicy(input)).toThrow("CAPABILITY_UNAVAILABLE");
    input.qualifications = [{ ...qualification, nativeInterface: "responses" }];
    const resolved = resolveModelPolicy(input);
    expect(() => validateModelRequest(resolved, request)).toThrow("store:false");
    expect(validateModelRequest(resolved, { ...request, options: { maxRetries: 0, providerOptions: { openai: { store: false } } } }).request.options.providerOptions).toEqual({ openai: { store: false } });
    expect(() => validateModelRequest(resolved, { ...request, options: { maxRetries: 0, providerOptions: { openai: { store: true } } } })).toThrow("INVALID_INPUT");
    input.policies[0].rules.nativeInterface = "messages"; input.policies[0].rules.interfaces = ["messages"];
    expect(() => resolveModelPolicy(input)).toThrow("CAPABILITY_UNSUPPORTED");
  });
  it("resolves ordered scope specialization independent of database arrival order", () => {
    const input = base();
    input.policies.push({ policyId: "tenant", version: 2, scope: "tenant", tenantId: "tenant", rules: { pins: { promptVersion: "tenant-prompt" }, limits: { concurrency: 2 } } },
      { policyId: "agent", version: 3, scope: "agent", tenantId: "tenant", agentId: "agent", agentVersion: 1, rules: { pins: { promptVersion: "agent-prompt" } } },
      { policyId: "operation", version: 4, scope: "deployment", operationKey: "agent.respond", rules: { pins: { promptVersion: "operation-prompt" } } });
    const resolved = resolveModelPolicy(input);
    expect(resolved.pins.promptVersion).toBe("operation-prompt"); expect(resolved.limits.concurrency).toBe(2);
    input.policies.reverse(); expect(resolveModelPolicy(input)).toEqual(resolved);
    expect(resolved.policyVersions.map((p) => p.policyId)).toEqual(["deployment", "tenant", "agent", "operation"]);
  });
  it("selects distinct per-function models only from explicitly supplied qualified receipts", () => {
    const chat = snapshot(); const input = base(); input.context.operationKey = "memory.extract";
    input.policies[0].rules.allowedModels?.push("fixture/extractor");
    input.policies.push({ policyId: "extraction-policy", version: 3, scope: "deployment", operationKey: "memory.extract", rules: { modelId: "fixture/extractor" } });
    expect(() => resolveModelPolicy(input)).toThrow("CAPABILITY_UNAVAILABLE");
    input.qualifications.push({ ...qualification, modelId: "fixture/extractor", receiptId: "synthetic-extraction-receipt" });
    const extraction = resolveModelPolicy(input);
    expect(chat.modelId).toBe(DEFAULT_CHAT_MODEL_ID); expect(extraction.modelId).toBe("fixture/extractor");
    expect(extraction.qualificationReceiptId).toBe("synthetic-extraction-receipt");
    expect(extraction.policyVersions).toContainEqual({ policyId: "extraction-policy", version: 3 });
  });
  it("intersects restrictions and never broadens deployment hard bounds", () => {
    const input = base(); input.policies.push({ policyId: "tenant", version: 1, scope: "tenant", tenantId: "tenant", rules: {
      allowedModels: [DEFAULT_CHAT_MODEL_ID, "fixture/other"], allowedOptions: ["temperature"], allowedTools: [],
      limits: { concurrency: 100, operationBudgetUnits: 600 } } });
    const resolved = resolveModelPolicy(input);
    expect(resolved.allowedModels).toEqual([DEFAULT_CHAT_MODEL_ID]); expect(resolved.allowedOptions).toEqual(["temperature"]);
    expect(resolved.allowedTools).toEqual([]); expect(resolved.limits).toMatchObject({ concurrency: 4, operationBudgetUnits: 600 });
    expect(() => validateModelRequest(resolved, { ...request, options: { maxRetries: 0, topP: 0.5 } })).toThrow("option is not allowed");
    expect(() => validateModelRequest(resolved, { ...request, tools: [{ name: "lookup", definition: {} }], toolSteps: 1 })).toThrow("tools are not allowed");
  });
  it("allows only exact versioned authorized overrides within hard bounds", () => {
    const input = base(); input.policies.push({ policyId: "tenant", version: 1, scope: "tenant", tenantId: "tenant", rules: { limits: { concurrency: 1 } } },
      { policyId: "admin-agent", version: 2, scope: "agent", tenantId: "tenant", agentId: "agent", agentVersion: 1,
        override: { actorPrincipalId: "admin", changeRevision: 7, authorizationId: "authorization" }, rules: { limits: { concurrency: 10 } } });
    expect(() => resolveModelPolicy(input)).toThrow("unauthorized");
    input.context.authorizedOverrides.push({ actorPrincipalId: "admin", changeRevision: 7, authorizationId: "authorization", policyId: "admin-agent", policyVersion: 2 });
    expect(resolveModelPolicy(input).limits.concurrency).toBe(4);
    input.policies.push({ policyId: "deployment-operation", version: 1, scope: "deployment", operationKey: "agent.respond", rules: { limits: { concurrency: 2 } } });
    expect(resolveModelPolicy(input).limits.concurrency).toBe(2);
    input.context.authorizedOverrides[0].policyVersion = 3; expect(() => resolveModelPolicy(input)).toThrow("unauthorized");
  });
  it("fails ambiguous, incomplete, unknown, cross-scope and stale-agent records closed", () => {
    expect(() => resolveModelPolicy({ ...base(), policies: [policy, policy] })).toThrow("ambiguous");
    expect(() => resolveModelPolicy({ ...base(), policies: [{ ...policy, rules: {} }] })).toThrow("incomplete");
    expect(() => resolveModelPolicy({ ...base(), modelId: "caller/model" })).toThrow("INVALID_INPUT");
    for (const tenantId of ["other"]) expect(() => resolveModelPolicy({ ...base(), policies: [policy,
      { policyId: "tenant", version: 1, scope: "tenant", tenantId, rules: {} }] })).toThrow();
    expect(() => resolveModelPolicy({ ...base(), policies: [policy, { policyId: "agent", version: 1, scope: "agent", tenantId: "tenant", agentId: "agent", agentVersion: 2, rules: {} }] })).toThrow("scope");
  });
  it("requires exact qualified capability/price/bound and rejects ambiguous receipts", () => {
    for (const modifications of [{ capabilities: ["embedding"] }, { priceRevision: "new" }, { boundRevision: "new" }, { modelId: "fixture/other" }]) {
      expect(() => resolveModelPolicy({ ...base(), qualifications: [{ ...qualification, ...modifications }] })).toThrow("CAPABILITY_UNAVAILABLE");
    }
    expect(() => resolveModelPolicy({ ...base(), qualifications: [qualification, qualification] })).toThrow("ambiguous");
    expect(() => resolveModelPolicy({ ...base(), qualifications: [{ ...qualification, costBound: { ...qualification.costBound, maximumCostUnits: 1001 } }] })).toThrow("cost ceiling");
    expect(() => resolveModelPolicy({ ...base(), qualifications: [{ ...qualification, costBound: { ...qualification.costBound, coversAllProviderCharges: false } }] })).toThrow("INVALID_INPUT");
    const input = base(); input.qualifications[0].limits = { ...limits, outputTokens: 200 };
    expect(resolveModelPolicy(input).limits.outputTokens).toBe(200);
  });
  it.each([NaN, Infinity, -1, 0.1, Number.MAX_SAFE_INTEGER + 1])("rejects invalid integer monetary bound %s", (value) => {
    const input = base(); input.policies[0].rules.limits = { ...limits, operationBudgetUnits: value };
    expect(() => resolveModelPolicy(input)).toThrow("INVALID_INPUT");
  });
  it("rejects zero positive caps, inconsistent ceilings and unqualified model IDs", () => {
    for (const changes of [{ concurrency: 0 }, { inputTokens: 3000 }, { operationBudgetUnits: 6000 }]) {
      const input = base(); input.policies[0].rules.limits = { ...limits, ...changes }; expect(() => resolveModelPolicy(input)).toThrow();
    }
    const input = base(); input.policies[0].rules.modelId = "gpt-4o-mini"; expect(() => resolveModelPolicy(input)).toThrow("INVALID_INPUT");
  });
  it("pins and deeply freezes snapshots without freezing or retaining caller objects", () => {
    const input = base(); const resolved = resolveModelPolicy(input);
    input.policies[0].rules.pins = { ...pins, promptVersion: "later" }; input.context.scope.grantVersion = 2;
    expect(resolved.pins.promptVersion).toBe("prompt-1"); expect(resolved.scope.grantVersion).toBe(1);
    expect(Object.isFrozen(resolved)).toBe(true); expect(Object.isFrozen(resolved.policyVersions[0])).toBe(true);
    expect(Object.isFrozen(resolved.allowedOptions)).toBe(true); expect(Object.isFrozen(input.context)).toBe(false);
    expect(() => { Reflect.set(resolved.limits, "concurrency", 10); }).not.toThrow(); expect(resolved.limits.concurrency).toBe(4);
  });
});

describe("exact dispatch request identity", () => {
  it("normalizes text and hashes exact canonical scope/source/policy/request", async () => {
    const resolved = snapshot(); const validated = validateModelRequest(resolved, request);
    expect(validated.request.texts).toEqual(["hello\nworld"]); expect(Object.isFrozen(validated.request.texts)).toBe(true);
    const identity = await createModelRequestIdentity(validated);
    const equivalent = await createModelRequestIdentity(validateModelRequest(resolved, { ...request, texts: ["hello\nworld"] }));
    expect(identity).toEqual(equivalent);
    const roleChanged = await createModelRequestIdentity(validateModelRequest(resolved, { ...request, messages: [{ role: "system", parts: [{ type: "text", text: "hello\nworld" }] }] }));
    expect(() => assertModelRequestIdentity(identity, roleChanged)).toThrow("IDEMPOTENCY_CONFLICT"); expect(identity.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(assertModelRequestIdentity(identity, equivalent)).toBeUndefined();
    for (const changes of [{ texts: ["changed"], messages: [{ role: "user" as const, parts: [{ type: "text" as const, text: "changed" }] }] }, { childCallId: "step-1" }, { options: { maxRetries: 0 as const, temperature: 0.3 } }]) {
      const next = await createModelRequestIdentity(validateModelRequest(resolved, { ...request, ...changes }));
      expect(() => assertModelRequestIdentity(identity, next)).toThrow("IDEMPOTENCY_CONFLICT");
    }
    const input = base(); input.context.source!.sourceRevision = 2;
    const newSource = await createModelRequestIdentity(validateModelRequest(resolveModelPolicy(input), request));
    expect(() => assertModelRequestIdentity(identity, newSource)).toThrow("IDEMPOTENCY_CONFLICT");
    expect(() => assertModelRequestIdentity(identity, { ...identity, canonical: "collision" })).toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("rejects invalid options, retries, headers, versions, token/time/cost/tool caps", () => {
    for (const changes of [{ options: { maxRetries: 1 } }, { options: { maxRetries: 0, headers: {} } },
      { options: { maxRetries: 0, temperature: NaN } }, { options: { maxRetries: 0, temperature: 3 } },
      { options: { maxRetries: 0, providerOptions: { openai: { store: false } } } }, { modelId: "caller/model" },
      { promptVersion: "new" }, { schemaVersion: "new" }, { toolRegistryVersion: "new" }, { extractionVersion: "new" },
      { inputTokens: 1001 }, { outputTokens: 501 }, { timeoutMs: 10001 }, { reservationUnits: 1001 }, { reservationUnits: 499 }, { toolSteps: 4 },
      { tools: [{ name: "unregistered", definition: {} }] }, { tools: [{ name: "lookup", definition: {} }] },
      { texts: ["   "] }, { outputSchema: {} }, { profile: DEFAULT_EMBEDDING_PROFILE }]) {
      expect(() => validateModelRequest(snapshot(), { ...request, ...changes })).toThrow();
    }
  });
  it("enforces combined context capacity independently of individual input/output ceilings", () => {
    const input = base(); input.qualifications[0].limits = { ...limits, contextTokens: 1100 };
    expect(() => validateModelRequest(resolveModelPolicy(input), { ...request, inputTokens: 1000, outputTokens: 101 })).toThrow("context");
    expect(validateModelRequest(resolveModelPolicy(input), { ...request, inputTokens: 1000, outputTokens: 100 }).request.outputTokens).toBe(100);
  });
  it("requires structured operation schema and validates tool definitions", () => {
    const input = base(); input.context.operationKey = "memory.extract"; const resolved = resolveModelPolicy(input);
    expect(() => validateModelRequest(resolved, request)).toThrow("schema mismatch");
    expect(validateModelRequest(resolved, { ...request, outputSchema: { type: "object" } }).request.outputSchema).toEqual({ type: "object" });
    expect(validateModelRequest(snapshot(), { ...request, toolSteps: 1, tools: [{ name: "lookup", definition: { type: "object" } }] }).request.tools).toHaveLength(1);
    expect(() => validateModelRequest(snapshot(), { ...request, toolSteps: 1, tools: [{ name: "lookup", definition: {} }, { name: "lookup", definition: {} }] })).toThrow("tools");
  });
  it("canonicalizes key order but rejects coercion, cycles, sparse arrays and accessor values", () => {
    expect(canonicalModelJson({ z: [1, true, null], a: "text" })).toBe('{"a":"text","z":[1,true,null]}');
    const cycle: Record<string, unknown> = {}; cycle.self = cycle;
    let effects = 0;
    const accessor = ["x"]; Object.defineProperty(accessor, "0", { get() { effects++; return "x"; }, enumerable: true });
    const iterator = ["x"]; Object.defineProperty(iterator, Symbol.iterator, { value() { effects++; return ["x"][Symbol.iterator](); } });
    const hidden = ["x"]; Object.defineProperty(hidden, "hidden", { value: 1 });
    const prototype = ["x"]; Object.setPrototypeOf(prototype, {});
    for (const invalid of [accessor, iterator, hidden, prototype]) expect(() => canonicalModelJson(invalid)).toThrow("INVALID_INPUT");
    expect(effects).toBe(0);
    for (const invalid of [undefined, NaN, Infinity, -0, new Date(), [undefined], Array(2), { value: undefined }, cycle, BigInt(2), { get value() { throw new Error("accessed"); } }]) {
      expect(() => canonicalModelJson(invalid)).toThrow("INVALID_INPUT");
    }
  });
});

describe("immutable default embedding policy", () => {
  function embedding() {
    const input = base(); input.context.operationKey = "embedding.query"; input.context.semanticProfile = { ...DEFAULT_EMBEDDING_PROFILE };
    input.policies[0].rules = { ...policy.rules, modelId: DEFAULT_EMBEDDING_PROFILE.modelId, interfaces: ["embedding"], capabilities: ["embedding"],
      allowedModels: [DEFAULT_EMBEDDING_PROFILE.modelId], allowedTools: [], allowedOptions: [] };
    input.qualifications = [{ ...qualification, modelId: DEFAULT_EMBEDDING_PROFILE.modelId, nativeInterface: "embedding", capabilities: ["embedding"], allowedOptions: [] }];
    return input;
  }
  it("requires actual qualified embedding receipt and every immutable profile field", () => {
    const input = embedding(); expect(resolveModelPolicy(input).semanticProfile).toEqual(DEFAULT_EMBEDDING_PROFILE);
    input.qualifications = []; expect(() => resolveModelPolicy(input)).toThrow("CAPABILITY_UNAVAILABLE");
    for (const field of ["modelId", "profileId", "normalization", "chunking", "indexName"] as const) {
      const changed = embedding(); changed.context.semanticProfile![field] = "fixture/changed";
      expect(() => resolveModelPolicy(changed)).toThrow("PROFILE_NOT_READY");
    }
    const missing = embedding(); delete missing.context.semanticProfile; expect(() => resolveModelPolicy(missing)).toThrow("PROFILE_NOT_READY");
  });
  it("pins batch ordinal/range and prohibits language/tool options or changed profiles", async () => {
    const resolved = resolveModelPolicy(embedding());
    const { messages: _messages, ...embeddingRequest } = request;
    const embedRequest = { ...embeddingRequest, outputTokens: 0, options: { maxRetries: 0 }, profile: DEFAULT_EMBEDDING_PROFILE, batch: { ordinal: 0, start: 0, end: 1 } };
    const first = await createModelRequestIdentity(validateModelRequest(resolved, embedRequest));
    const second = await createModelRequestIdentity(validateModelRequest(resolved, { ...embedRequest, batch: { ordinal: 1, start: 1, end: 2 } }));
    expect(() => assertModelRequestIdentity(first, second)).toThrow("IDEMPOTENCY_CONFLICT");
    expect(() => validateModelRequest(resolved, { ...embedRequest, profile: { ...DEFAULT_EMBEDDING_PROFILE, dimensions: 768 } })).toThrow("PROFILE_NOT_READY");
    expect(() => validateModelRequest(resolved, { ...embedRequest, batch: { ordinal: 0, start: 0, end: 2 } })).toThrow("embedding batch");
    expect(() => validateModelRequest(resolved, { ...embedRequest, outputTokens: 1 })).toThrow("embedding batch");
    expect(canFallbackModel(resolved, DEFAULT_EMBEDDING_PROFILE.modelId, safe)).toBe(false);
  });
});

describe("conservative fallback eligibility", () => {
  it("permits only registered qualified candidates with positive predispatch/rejection proof", () => {
    expect(canFallbackModel(fallbackSnapshot(), "fixture/alternative", safe)).toBe(true);
    expect(canFallbackModel(fallbackSnapshot(), "fixture/alternative", { ...safe, outcome: "confirmed_rejected", proof: "qualified_rejection" })).toBe(true);
    expect(canFallbackModel(fallbackSnapshot(), "fixture/unknown", safe)).toBe(false);
    expect(canFallbackModel(fallbackSnapshot(), "fixture/alternative", { ...safe, proof: "none" })).toBe(false);
    const input = base(); input.policies[0].rules.fallbackModels = ["fixture/alternative"]; input.policies[0].rules.allowedModels?.push("fixture/alternative");
    expect(() => resolveModelPolicy(input)).toThrow("fallback");
  });
  it("forbids visible text/tools, committed effects, ambiguous paid/cancelled and unchecked replay", () => {
    for (const field of ["outputVisible", "toolInputVisible", "toolResultVisible", "toolEffectCommitted", "paidLiabilityUncertain", "cancelled"] as const) {
      expect(canFallbackModel(fallbackSnapshot(), "fixture/alternative", { ...safe, [field]: true })).toBe(false);
    }
    for (const field of ["priorAttemptAccounted", "currentAuthorityChecked", "currentSourceChecked", "currentPolicyChecked"] as const) {
      expect(canFallbackModel(fallbackSnapshot(), "fixture/alternative", { ...safe, [field]: false })).toBe(false);
    }
    for (const outcome of ["confirmed", "uncertain"]) expect(canFallbackModel(fallbackSnapshot(), "fixture/alternative", { ...safe, outcome })).toBe(false);
    expect(canFallbackModel(fallbackSnapshot(), "fixture/alternative", { ...safe, unknown: true })).toBe(false);
    expect(canFallbackModel(fallbackSnapshot(), "fixture/alternative", null)).toBe(false);
  });
});

// C2 regressions appended: every original C1 test byte above remains unchanged.
describe("detached canonical request data and effect-free fallback evidence", () => {
  function assertDetachedGraph(original: unknown, admitted: unknown): void {
    if (original !== null && typeof original === "object") {
      expect(admitted).not.toBe(original);
      expect(Object.isFrozen(original)).toBe(false);
      expect(Object.isFrozen(admitted)).toBe(true);
      for (const [key, child] of Object.entries(original)) {
        assertDetachedGraph(child, (admitted as Record<string, unknown>)[key]);
      }
    } else expect(admitted).toEqual(original);
  }

  it.each(["tool definition", "output schema", "tool call input", "tool result output"] as const)(
    "detaches nested %s without changing or freezing caller-owned data", (family) => {
      const nested = { fields: { label: "before", values: [{ count: 1 }, ["unchanged"]] } };
      const input: ModelCallRequest = JSON.parse(JSON.stringify(request)) as ModelCallRequest;
      let resolved = snapshot();
      if (family === "tool definition") {
        input.tools = [{ name: "lookup", definition: nested }]; input.toolSteps = 1;
      } else if (family === "output schema") {
        const policyInput = base(); policyInput.context.operationKey = "memory.extract";
        resolved = resolveModelPolicy(policyInput); input.outputSchema = nested;
      } else {
        input.toolSteps = 1;
        input.tools = [{ name: "lookup", definition: { type: "object" } }];
        input.messages?.push(family === "tool call input"
          ? { role: "assistant", parts: [{ type: "tool-call", toolCallId: "call-1", toolName: "lookup", input: nested }] }
          : { role: "tool", parts: [{ type: "tool-result", toolCallId: "call-1", toolName: "lookup", output: nested }] });
      }
      const originalCanonical = canonicalModelJson(input);
      const validated = validateModelRequest(resolved, input);
      const selected = family === "tool definition" ? validated.request.tools[0].definition
        : family === "output schema" ? validated.request.outputSchema
        : validated.request.messages?.[1].parts[0];
      const admitted = family === "tool call input" && selected && "input" in selected ? selected.input
        : family === "tool result output" && selected && "output" in selected ? selected.output : selected;
      assertDetachedGraph(nested, admitted);
      expect(canonicalModelJson(input)).toBe(originalCanonical);
      const admittedBeforeMutation = canonicalModelJson(admitted);
      const identityBeforeMutation = validated.canonical;
      nested.fields.label = "caller changed";
      nested.fields.values.push({ count: 2 });
      expect(nested.fields.label).toBe("caller changed");
      expect(nested.fields.values).toHaveLength(3);
      expect(canonicalModelJson(admitted)).toBe(admittedBeforeMutation);
      expect(validated.canonical).toBe(identityBeforeMutation);
      expect(validated.canonical).toBe(canonicalModelJson({ snapshot: resolved, request: validated.request }));
    },
  );

  it("rejects fallback accessor evidence without evaluating counting or throwing getters", () => {
    const resolved = fallbackSnapshot();
    let effects = 0;
    for (const throwing of [false, true]) {
      const evidence = { ...safe };
      Object.defineProperty(evidence, "outcome", { enumerable: true, get() {
        effects++;
        if (throwing) throw new Error("getter must not execute");
        return "not_dispatched";
      } });
      expect(canFallbackModel(resolved, "fixture/alternative", evidence)).toBe(false);
      expect(effects).toBe(0);
    }
    expect(canFallbackModel(resolved, "fixture/alternative", safe)).toBe(true);
  });

  it("rejects symbolic, nonplain, nonenumerable and iterator fallback evidence with zero effects", () => {
    const resolved = fallbackSnapshot(); let effects = 0;
    const symbolic = { ...safe }; Object.defineProperty(symbolic, Symbol("hidden"), { get() { effects++; return true; } });
    const nonplain = Object.create({ ...safe }) as unknown;
    const hidden = { ...safe }; Object.defineProperty(hidden, "hidden", { value: true, enumerable: false });
    const iterable = { ...safe, [Symbol.iterator]() { effects++; return [safe][Symbol.iterator](); } };
    const accessorArray = [safe]; Object.defineProperty(accessorArray, "0", { enumerable: true, get() { effects++; return safe; } });
    const iteratorArray = [safe]; Object.defineProperty(iteratorArray, Symbol.iterator, { value() { effects++; return [safe][Symbol.iterator](); } });
    for (const invalid of [symbolic, nonplain, hidden, iterable, accessorArray, iteratorArray]) {
      expect(canFallbackModel(resolved, "fixture/alternative", invalid)).toBe(false);
    }
    expect(effects).toBe(0);
    expect(canFallbackModel(resolved, "fixture/alternative", safe)).toBe(true);
  });
});

// C3 regressions appended: every original C2 test byte above remains unchanged.
describe("lossless own JSON keys at arbitrary record boundaries", () => {
  it.each(["tool definition", "output schema", "tool call input", "tool result output"] as const)(
    "preserves an own __proto__ key in %s and keeps its request identity distinct", async (family) => {
      function inputFor(record: Record<string, unknown>): { input: ModelCallRequest; resolved: ReturnType<typeof snapshot> } {
        const input = JSON.parse(JSON.stringify(request)) as ModelCallRequest;
        let resolved = snapshot();
        if (family === "tool definition") {
          input.tools = [{ name: "lookup", definition: record }]; input.toolSteps = 1;
        } else if (family === "output schema") {
          const policyInput = base(); policyInput.context.operationKey = "memory.extract";
          resolved = resolveModelPolicy(policyInput); input.outputSchema = record;
        } else {
          input.toolSteps = 1;
          input.tools = [{ name: "lookup", definition: { type: "object" } }];
          input.messages?.push(family === "tool call input"
            ? { role: "assistant", parts: [{ type: "tool-call", toolCallId: "call-1", toolName: "lookup", input: record }] }
            : { role: "tool", parts: [{ type: "tool-result", toolCallId: "call-1", toolName: "lookup", output: record }] });
        }
        return { input, resolved };
      }
      const ownKey = JSON.parse('{"__proto__":{"cortexC3Marker":"retained"}}') as Record<string, unknown>;
      const { input, resolved } = inputFor(ownKey);
      const admitted = validateModelRequest(resolved, input);
      const selected = family === "tool definition" ? admitted.request.tools[0].definition
        : family === "output schema" ? admitted.request.outputSchema : admitted.request.messages?.[1].parts[0];
      const record = family === "tool call input" && selected && "input" in selected ? selected.input
        : family === "tool result output" && selected && "output" in selected ? selected.output : selected;
      expect(canonicalModelJson(record)).toBe('{"__proto__":{"cortexC3Marker":"retained"}}');
      expect(Object.hasOwn(record as object, "__proto__")).toBe(true);
      expect(Object.getPrototypeOf(record)).toBe(Object.prototype);
      expect(Object.isFrozen(record)).toBe(true);
      expect(Object.isFrozen(ownKey)).toBe(false);
      expect(record).not.toBe(ownKey);
      const empty = inputFor({});
      const ownIdentity = await createModelRequestIdentity(admitted);
      const emptyIdentity = await createModelRequestIdentity(validateModelRequest(empty.resolved, empty.input));
      expect(ownIdentity.canonical).not.toBe(emptyIdentity.canonical);
      expect(ownIdentity.hash).not.toBe(emptyIdentity.hash);
      expect(() => assertModelRequestIdentity(ownIdentity, emptyIdentity)).toThrow("IDEMPOTENCY_CONFLICT");
      expect(Object.hasOwn(Object.prototype, "cortexC3Marker")).toBe(false);
      expect(Object.hasOwn({}, "cortexC3Marker")).toBe(false);
    },
  );

  it("preserves hostile-looking own keys at multiple depths without prototype mutation or aliasing", () => {
    const definition = JSON.parse('{"__proto__":{"cortexC3Marker":"root"},"constructor":{"prototype":{"cortexC3Marker":"constructor"}},"prototype":{"__proto__":{"cortexC3Marker":"nested"}},"array":[{"__proto__":{"cortexC3Marker":"array"}}]}') as Record<string, unknown>;
    const before = canonicalModelJson(definition);
    const admitted = validateModelRequest(snapshot(), { ...request, toolSteps: 1, tools: [{ name: "lookup", definition }] });
    const output = admitted.request.tools[0].definition;
    expect(canonicalModelJson(output)).toBe(before);
    expect(Object.keys(output).sort()).toEqual(["__proto__", "array", "constructor", "prototype"]);
    const ownDescriptor = Object.getOwnPropertyDescriptor(output, "__proto__");
    expect(ownDescriptor).toMatchObject({ enumerable: true, writable: false, configurable: false });
    expect(Object.getPrototypeOf(output)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(ownDescriptor?.value)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, "cortexC3Marker")).toBe(false);
    expect(Object.hasOwn(Object.prototype, "prototype")).toBe(false);
    expect(Object.hasOwn({}, "cortexC3Marker")).toBe(false);
    expect(Object.isFrozen(definition)).toBe(false);
    const callerProtoValue = Object.getOwnPropertyDescriptor(definition, "__proto__")?.value as Record<string, unknown>;
    expect(Object.isFrozen(callerProtoValue)).toBe(false);
    callerProtoValue.cortexC3Marker = "caller mutation";
    expect(canonicalModelJson(output)).toBe(before);
    expect(canonicalModelJson(definition)).not.toBe(before);
  });
});
