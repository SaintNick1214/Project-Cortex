/** FIXTURE ONLY. No actual provider/token/framing/price qualification. */
import type {DeploymentPolicyManifest} from "./runtimeModelPolicyBootstrap";
import type {TrustedModelQualification} from "../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE } from "../src/domain/profile";
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
const digest = "f".repeat(64);
const limits = { inputTokens: 1000, contextTokens: 2000, outputTokens: 500, toolSteps: 4,
  timeoutMs: 10000, operationBudgetUnits: 10000, runBudgetUnits: 20000, tenantBudgetUnits: 50000, concurrency: 4 };
const pins = { promptVersion: "qa-prompt-1", schemaVersion: "qa-schema-1", extractionVersion: "qa-extract-1",
  toolRegistryVersion: "qa-tools-1", priceRevision: "qa-price-1", boundRevision: "qa-bound-1" };
const chat = "openai/gpt-4o-mini", fallback = "fixture/fallback";
const qualifications: TrustedModelQualification[] = [chat, fallback, DEFAULT_EMBEDDING_PROFILE.modelId].map((modelId) => ({
  receiptId: modelId === chat ? "qa-chat" : modelId === fallback ? "qa-fallback" : "qa-embedding", modelId,
  nativeInterface: modelId === DEFAULT_EMBEDDING_PROFILE.modelId ? "embedding" : "chat",
  capabilities: modelId === DEFAULT_EMBEDDING_PROFILE.modelId ? ["embedding"] : ["text"], allowedOptions: ["temperature"],
  limits, costBound: { kind: "qualified-call-ceiling", maximumCostUnits: modelId === fallback ? 80 : 100,
    provenance: "fixture-synthetic-bookkeeping-only", coversAllProviderCharges: true }, priceRevision: pins.priceRevision, boundRevision: pins.boundRevision,
}));
const fixed: DeploymentPolicyManifest = {
  manifestId: "qa-task04-synthetic-v1", revision: 1, artifactRevision: "qa-c2-ledger-only", evidenceHash: digest,
  acceptanceHash: digest, classification: "fixture-synthetic", budgetWindowMs: 60000,
  policies: [{ policyId: "qa-deployment", version: 1, scope: "deployment", rules: {
    modelId: chat, nativeInterface: "chat", allowedModels: [chat, fallback, DEFAULT_EMBEDDING_PROFILE.modelId],
    interfaces: ["chat", "embedding"], capabilities: ["text", "embedding"], allowedOptions: ["temperature"], allowedTools: [],
    fallbackModels: [fallback], limits, pins } }, {policyId:"qa-agent-policy",version:1,scope:"agent",tenantId:"admission-68061eae2f544b359edc485d5b2ae889-agent-selector-denial",agentId:"qa-agent",agentVersion:7,rules:{limits:{outputTokens:100}}}], qualifications,
  dispatchEvidence: qualifications.map((q) => ({ receiptId: q.receiptId, evidenceHash: digest, providerVersion: "fixture-synthetic-0",
    nativeInterface: q.nativeInterface, modelId: q.modelId,
    inputBound: { ruleId: q.nativeInterface === "embedding" ? "default-embedding-utf8-v1" : "plain-chat-cookbook-utf8-v1",
      revision: 1, featureEnvelope: q.nativeInterface === "embedding" ? "default-embedding-v1" : "plain-chat-v1",
      nativeTransformHash: digest, documentHash: digest, proofHash: digest },
    resultBound: { maximumPrivateResultBytes: 60000, maximumOutputTokens: 500, maximumEmbeddingValues: 1, proofHash: digest },
    checkedAt: 0, expiresAt: 4102444800000, terminalCost: "gateway-aggregate-usd-v1", terminalProof: "provider-terminal-v1",
    priceRevision: q.priceRevision, boundRevision: q.boundRevision,
  })),
};

export const syntheticManifest=freeze(fixed);
