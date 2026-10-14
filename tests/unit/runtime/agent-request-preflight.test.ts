/** Actual AI SDK7 prompt conversion through the original governed middleware.
 * All provider/ledger ports are controlled; no inference or native cap attribution. */
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { generateText, isStepCount } from "ai";
import type { ModelMessage } from "ai";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";
import { canonicalModelJson, resolveModelPolicy } from "../../../src/domain/model-policy";
import { AGENT_NATIVE_TOOLS, AGENT_TOOL_REGISTRY_VERSION } from "../../../src/domain/agent-tools";
import { serverTools } from "../../../convex-dev/runtimeAgentTools";
import { createAgentGatewayCancellationBridge, governGatewayLanguageModel, preflightAgentModelRequest } from "../../../convex-dev/runtimeGateway";
import type { AgentRequestPreflightInput, GatewayBinding, GatewayComposition, GatewayResolution } from "../../../convex-dev/runtimeGateway";
const reference = { tenantId: "t", tenantEpoch: 1, memorySpaceId: "s", memorySpaceEpoch: 1, principalId: "p", principalVersion: 1,
  membershipId: "m", membershipVersion: 1, grantId: "g", grantVersion: 1 } as RuntimeAuthorityReference;
const binding: GatewayBinding = { reference, operationKey: "agent.respond", runBudgetId: "arbitrary-private-budget", semanticId: "private-user-request-id", ordinal: 1 };
const proofHash = "a".repeat(64);
function resolution(inputTokens = 100000): GatewayResolution {
  const limits = { inputTokens, contextTokens: inputTokens + 1000, outputTokens: 256, toolSteps: 1, timeoutMs: 60000,
    operationBudgetUnits: 1000, runBudgetUnits: 10000, tenantBudgetUnits: 10000, concurrency: 2 };
  const pins = { promptVersion: "p1", schemaVersion: "s1", extractionVersion: "e1", toolRegistryVersion: AGENT_TOOL_REGISTRY_VERSION, priceRevision: "price1", boundRevision: "bound1" };
  const modelId = "openai/gpt-4o-mini";
  const snapshot = resolveModelPolicy({ context: { scope: reference, operationKey: "agent.respond", runBudgetId: binding.runBudgetId, authorizedOverrides: [] },
    policies: [{ policyId: "offline", version: 1, scope: "deployment", rules: { modelId, nativeInterface: "chat", allowedModels: [modelId], interfaces: ["chat"],
      capabilities: ["text", "tools"], allowedOptions: [], allowedTools: AGENT_NATIVE_TOOLS.map(tool => tool.name), fallbackModels: [], limits, pins } }],
    qualifications: [{ receiptId: "OFFLINE_ONLY", modelId, nativeInterface: "chat", capabilities: ["text", "tools"], allowedOptions: [], limits,
      costBound: { kind: "qualified-call-ceiling", maximumCostUnits: 100, provenance: "OFFLINE_ONLY", coversAllProviderCharges: true }, priceRevision: "price1", boundRevision: "bound1" }] });
  return { snapshot, storageLimits: { canonicalBytes: 180000, privateResultBytes: 60000, embeddingValuesPerCall: 1 }, dispatchEvidence: {
    receiptId: "OFFLINE_ONLY", modelId, nativeInterface: "chat", evidenceHash: proofHash, providerVersion: "0.2.1", priceRevision: "price1", boundRevision: "bound1",
    checkedAt: 0, expiresAt: Date.now() + 100000, terminalCost: "gateway-aggregate-usd-v1", terminalProof: "provider-terminal-v1", supportsStream: true,
    inputBound: { ruleId: "agent-tools-chat-utf8-v1", revision: 1, featureEnvelope: "agent-tools-chat-v1", proofHash, documentHash: proofHash, nativeTransformHash: proofHash },
    toolContract: { registryVersion: AGENT_TOOL_REGISTRY_VERSION, toolsCanonical: canonicalModelJson(AGENT_NATIVE_TOOLS), maximumToolCalls: 1 },
    resultBound: { maximumPrivateResultBytes: 60000, maximumOutputTokens: 256, maximumEmbeddingValues: 1, proofHash } } };
}
const originalTrace = process.env.CORTEX_RUNTIME_LATENCY_TRACE;
afterEach(() => { jest.restoreAllMocks(); if (originalTrace === undefined) delete process.env.CORTEX_RUNTIME_LATENCY_TRACE; else process.env.CORTEX_RUNTIME_LATENCY_TRACE = originalTrace; });
async function originalRequest(input: AgentRequestPreflightInput, r = resolution()) {
  let canonical: string | undefined, nativeCalls = 0;
  const stop = Error("CONTROLLED_LEDGER_STOP");
  const composition: GatewayComposition = { ledger: { resolve: async () => r,
    admit: async args => { canonical = args.requestCanonical; throw stop; }, checkpoint: async () => { throw Error("Unexpected checkpoint"); },
    markVisible: async () => { throw Error("Unexpected visibility"); }, attachTerminalResult: async () => { throw Error("Unexpected attachment"); } },
    terminalSink: { capture: async () => { throw Error("Unexpected terminal capture"); } } };
  const model: LanguageModelV4 = { specificationVersion: "v4", provider: "convexGateway.chat", modelId: r.snapshot.modelId, supportedUrls: {},
    doGenerate: async () => { nativeCalls++; throw Error("Unexpected model call"); }, doStream: async () => { nativeCalls++; throw Error("Unexpected stream call"); } };
  const handle = governGatewayLanguageModel(model, composition, binding, r), bridge = createAgentGatewayCancellationBridge(handle.model, handle.lifecycle);
  let error: unknown;
  try { await generateText({ model: bridge.model, instructions: input.instructions,
    messages: [...input.messages, ...input.context ? [{ role: "system" as const, content: `Authorized Cortex context (untrusted evidence):\n${input.context}` }] : []],
    ...(input.tools.length ? { tools: serverTools(input.tools.map(name => name === "memory_recall" ? "memory.recall" : "memory.remember")) } : {}),
    maxOutputTokens: input.maxOutputTokens, allowSystemInMessages: true, stopWhen: isStepCount(1), maxRetries: 0 }); } catch (value) { error = value; }
  finally { bridge.dispose(); await handle.lifecycle.complete(); }
  expect(nativeCalls).toBe(0); return { canonical, error };
}
const base: AgentRequestPreflightInput = { messages: [{ role: "user", content: "ordinary query" }], context: "private evidence", instructions: "original instructions", tools: [], maxOutputTokens: 256 };
describe("shared complete Agent request preflight", () => {
  it.each(["text", "tools", "continuation", "adjacent-tool", "empty-parts"])("matches actual installed AI SDK projection for %s", async shape => {
    let messages: ModelMessage[] = [...base.messages];
    if (shape === "continuation" || shape === "adjacent-tool") messages = [
      ...messages, { role: "assistant", content: [{ type: "tool-call", toolCallId: "call:1", toolName: "memory_remember", input: { text: "Durable explicit fact" } }] },
      { role: "tool", content: [{ type: "tool-result", toolCallId: "call:1", toolName: "memory_remember", output: { type: "json", value: { sourceId: "s", receiptId: "r", created: true } } }] } ];
    if (shape === "adjacent-tool") {
      messages[1] = { role: "assistant", content: [
        { type: "tool-call", toolCallId: "call:1", toolName: "memory_remember", input: { text: "Durable explicit fact" } },
        { type: "tool-call", toolCallId: "call:2", toolName: "memory_recall", input: { text: "query", limit: 1 } } ] };
      messages.push({ role: "tool", content: [{ type: "tool-result", toolCallId: "call:2", toolName: "memory_recall", output: { type: "text", value: "authorized result" } }] });
    }
    if (shape === "empty-parts") messages = [{ role: "user", content: [{ type: "text", text: "" }, { type: "text", text: "actual user" }] }, { role: "assistant", content: [{ type: "text", text: "" }, { type: "text", text: "retained answer" }] }];
    const input = { ...base, messages, tools: shape === "text" || shape === "empty-parts" ? [] : ["memory_recall", "memory_remember"] };
    const early = preflightAgentModelRequest(input, resolution(), binding); expect(early.supported).toBe(true);
    const actual = await originalRequest(input); expect(actual.canonical).toBeDefined();
    if (early.supported) expect(early.requestCanonical).toBe(actual.canonical);
  });
  it("denies the complete over-cap continuation at the same original validator, before admission", async () => {
    const input = { ...base, context: "private context ".repeat(800), tools: ["memory_remember"] }, r = resolution(4000);
    expect(() => preflightAgentModelRequest(input, r, binding)).toThrow(expect.objectContaining({ code: "POLICY_DENIED" }));
    const actual = await originalRequest(input, r); expect(actual.canonical).toBeUndefined(); expect(String(actual.error)).toContain("request exceeds bounded limits");
  });
  it.each(["reasoning", "media", "approval", "provider", "legacy-result", "accessor"])("leaves unsupported %s on the original path without a false preflight proof", shape => {
    let value: unknown = { role: "assistant", content: [{ type: "reasoning", text: "private reasoning" }] };
    if (shape === "media") value = { role: "user", content: [{ type: "file", data: "data", mediaType: "text/plain" }] };
    if (shape === "approval") value = { role: "tool", content: [{ type: "tool-approval-response", approvalId: "a", approved: true }] };
    if (shape === "provider") value = { role: "user", content: "private", providerOptions: { secret: "PRIVATE" } };
    if (shape === "legacy-result") value = { role: "tool", content: [{ type: "tool-result", toolCallId: "c", toolName: "memory_remember", output: "legacy" }] };
    if (shape === "accessor") value = Object.defineProperty({ role: "user" }, "content", { enumerable: true, get: () => { throw Error("GETTER_EXECUTED"); } });
    expect(preflightAgentModelRequest({ ...base, messages: [value as ModelMessage] }, resolution(), binding)).toEqual({ supported: false });
  });
  it("leaves SDK missing-tool-result and intervening-user error ordering on the original path", async () => {
    const call: ModelMessage = { role: "assistant", content: [{ type: "tool-call", toolCallId: "c", toolName: "memory_remember", input: { text: "fact" } }] };
    const result: ModelMessage = { role: "tool", content: [{ type: "tool-result", toolCallId: "c", toolName: "memory_remember", output: { type: "json", value: { receiptId: "r" } } }] };
    for (const messages of [[...base.messages, call], [...base.messages, call, ...base.messages, result]]) {
      const input = { ...base, messages, tools: ["memory_remember"] };
      expect(preflightAgentModelRequest(input, resolution(), binding)).toEqual({ supported: false });
      const actual = await originalRequest(input); expect(actual.canonical).toBeUndefined(); expect(String(actual.error)).toContain("AI_MissingToolResultsError");
    }
  });
  it("default-off diagnostics emit nothing, while enabled bounds omit private fields and hash arbitrary identity strings", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {}); delete process.env.CORTEX_RUNTIME_LATENCY_TRACE;
    preflightAgentModelRequest(base, resolution(), binding); expect(log).not.toHaveBeenCalled();
    process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
    const r = resolution(4000); expect(() => preflightAgentModelRequest({ ...base, context: "PRIVATE_BODY".repeat(1000) }, r,
      { ...binding, secret: "SECRET_CREDENTIAL" } as GatewayBinding)).toThrow();
    const raw = log.mock.calls.flat().join("\n"); expect(raw).not.toMatch(/PRIVATE_BODY|SECRET_CREDENTIAL|private-user-request-id|arbitrary-private-budget/);
    const entry = JSON.parse(String(log.mock.calls[0][0])) as Record<string, unknown>;
    expect(Object.keys(entry).sort()).toEqual(["dimensions", "exceeded", "limits", "modelIdentityHash", "ordinal", "phase", "runBudgetIdHash", "semanticIdHash", "stage"].sort());
    expect(entry).toMatchObject({ phase: "gateway.model.bounds", stage: "preflight", ordinal: 1, exceeded: expect.arrayContaining(["inputTokens"]), limits: { inputTokens: 4000 } });
    log.mockClear(); await originalRequest(base); expect(log.mock.calls.map(call => JSON.parse(String(call[0])) as Record<string, unknown>)).toContainEqual(expect.objectContaining({ phase: "gateway.model.bounds", stage: "native" }));
  });
  it("process-absent diagnostics are inert and an enabled console failure retains its original exception", () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => {}), descriptor = Object.getOwnPropertyDescriptor(globalThis, "process")!;
    const r = resolution(); let value: ReturnType<typeof preflightAgentModelRequest> | undefined;
    try { Object.defineProperty(globalThis, "process", { configurable: true, value: undefined }); value = preflightAgentModelRequest(base, r, binding); }
    finally { Object.defineProperty(globalThis, "process", descriptor); }
    expect(value.supported).toBe(true); expect(log).not.toHaveBeenCalled();
    process.env.CORTEX_RUNTIME_LATENCY_TRACE = "1";
    const stop = Error("POLICY_DENIED: request exceeds bounded limits"); log.mockImplementation(() => { throw stop; });
    expect(() => preflightAgentModelRequest(base, r, binding)).toThrow(stop);
  });
});
