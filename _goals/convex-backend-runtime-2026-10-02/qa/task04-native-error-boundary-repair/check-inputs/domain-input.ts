import { DEFAULT_CHAT_MODEL_ID, DEFAULT_EMBEDDING_PROFILE, resolveModelPolicy } from "/workspace/Project-Cortex/src/domain/index";
import type { ModelCallRequest, ModelPolicyLimits, ModelPolicyPins, TrustedModelPolicyContext, TrustedModelPolicyRecord, TrustedModelQualification } from "/workspace/Project-Cortex/src/domain/index";
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

export { base, snapshot, request };
