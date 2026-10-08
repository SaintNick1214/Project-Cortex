var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeModelPolicyBootstrap.ts
var runtimeModelPolicyBootstrap_exports = {};
__export(runtimeModelPolicyBootstrap_exports, {
  isTrustedDeploymentManifest: () => isTrustedDeploymentManifest,
  lookupDeploymentManifest: () => lookupDeploymentManifest
});

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/src/domain/profile.ts
var DEFAULT_EMBEDDING_PROFILE = Object.freeze({
  profileId: "cortex-text-small-1536-v1",
  modelId: "openai/text-embedding-3-small",
  dimensions: 1536,
  normalization: "text-nfc-lf-v1",
  chunking: "codepoint-1600-overlap-200-v1",
  indexName: "by_default_embedding_v1"
});
var DEFAULT_VECTOR_FILTER_FIELDS = Object.freeze([
  "tenantId",
  "memorySpaceId",
  "profileId"
]);

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/qualificationManifest.ts
function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
var digest = "f".repeat(64);
var limits = {
  inputTokens: 1e3,
  contextTokens: 2e3,
  outputTokens: 500,
  toolSteps: 4,
  timeoutMs: 1e4,
  operationBudgetUnits: 1e4,
  runBudgetUnits: 2e4,
  tenantBudgetUnits: 5e4,
  concurrency: 4
};
var pins = {
  promptVersion: "qa-prompt-1",
  schemaVersion: "qa-schema-1",
  extractionVersion: "qa-extract-1",
  toolRegistryVersion: "qa-tools-1",
  priceRevision: "qa-price-1",
  boundRevision: "qa-bound-1"
};
var chat = "openai/gpt-4o-mini";
var fallback = "fixture/fallback";
var qualifications = [chat, fallback, DEFAULT_EMBEDDING_PROFILE.modelId].map((modelId) => ({
  receiptId: modelId === chat ? "qa-chat" : modelId === fallback ? "qa-fallback" : "qa-embedding",
  modelId,
  nativeInterface: modelId === DEFAULT_EMBEDDING_PROFILE.modelId ? "embedding" : "chat",
  capabilities: modelId === DEFAULT_EMBEDDING_PROFILE.modelId ? ["embedding"] : ["text"],
  allowedOptions: ["temperature"],
  limits,
  costBound: {
    kind: "qualified-call-ceiling",
    maximumCostUnits: modelId === fallback ? 80 : 100,
    provenance: "fixture-synthetic-bookkeeping-only",
    coversAllProviderCharges: true
  },
  priceRevision: pins.priceRevision,
  boundRevision: pins.boundRevision
}));
var fixed = {
  manifestId: "qa-task04-synthetic-v1",
  revision: 1,
  artifactRevision: "qa-c2-ledger-only",
  evidenceHash: digest,
  acceptanceHash: digest,
  classification: "fixture-synthetic",
  budgetWindowMs: 6e4,
  policies: [{ policyId: "qa-deployment", version: 1, scope: "deployment", rules: {
    allowedModels: [chat, fallback, DEFAULT_EMBEDDING_PROFILE.modelId],
    interfaces: ["chat", "embedding"],
    capabilities: ["text", "embedding"],
    allowedOptions: ["temperature"],
    allowedTools: [],
    fallbackModels: [fallback],
    limits,
    pins
  } }, { policyId: "qa-agent-policy", version: 1, scope: "agent", tenantId: "admission-a6f48c36ac2cd274d7b26ff3e6fbbf8a-agent-selector-denial", agentId: "qa-agent", agentVersion: 7, rules: { limits: { outputTokens: 100 } } }],
  qualifications: qualifications.filter((q) => q.nativeInterface === "chat"),
  dispatchEvidence: qualifications.filter((q) => q.nativeInterface === "chat").map((q) => ({
    receiptId: q.receiptId,
    evidenceHash: digest,
    providerVersion: "fixture-synthetic-0",
    nativeInterface: q.nativeInterface,
    modelId: q.modelId,
    inputBound: {
      ruleId: q.nativeInterface === "embedding" ? "default-embedding-utf8-v1" : "plain-chat-cookbook-utf8-v1",
      revision: 1,
      featureEnvelope: q.nativeInterface === "embedding" ? "default-embedding-v1" : "plain-chat-v1",
      nativeTransformHash: digest,
      documentHash: digest,
      proofHash: digest
    },
    resultBound: { maximumPrivateResultBytes: 6e4, maximumOutputTokens: 500, maximumEmbeddingValues: 1, proofHash: digest },
    checkedAt: 0,
    expiresAt: 41024448e5,
    terminalCost: "gateway-aggregate-usd-v1",
    terminalProof: "provider-terminal-v1",
    priceRevision: q.priceRevision,
    boundRevision: q.boundRevision
  }))
};
var syntheticManifest = freeze(fixed);
var embeddingQualifications = qualifications.filter((q) => q.nativeInterface === "embedding");
var embedding = {
  ...fixed,
  manifestId: "qa-task04-synthetic-embedding-v1",
  policies: [{ ...fixed.policies[0], policyId: "qa-embedding-deployment", rules: { ...fixed.policies[0].rules, fallbackModels: [] } }],
  qualifications: embeddingQualifications,
  dispatchEvidence: embeddingQualifications.map((q) => ({
    ...fixed.dispatchEvidence[0],
    receiptId: q.receiptId,
    modelId: q.modelId,
    nativeInterface: q.nativeInterface,
    inputBound: { ...fixed.dispatchEvidence[0].inputBound, ruleId: "default-embedding-utf8-v1", featureEnvelope: "default-embedding-v1" }
  }))
};
var syntheticEmbeddingManifest = freeze(embedding);

// _goals/convex-backend-runtime-2026-10-02/qa/task04-native-admission-fixture-c7/fixture/convex/runtimeModelPolicyBootstrap.ts
var manifests = Object.freeze([syntheticManifest, syntheticEmbeddingManifest]);
function lookupDeploymentManifest(id, revision) {
  const selected = manifests.filter((entry) => entry.manifestId === id && entry.revision === revision);
  return selected.length === 1 ? selected[0] : void 0;
}
function isTrustedDeploymentManifest(manifest) {
  return manifest.classification === "fixture-synthetic" && ["qa-task04-synthetic-v1", "qa-task04-synthetic-embedding-v1"].includes(manifest.manifestId) && manifest.revision === 1 && manifests.some((entry) => entry === manifest);
}

// convex-dev/runtimeModelPolicyBootstrap.ts
var runtimeModelPolicyBootstrap_exports2 = {};
__export(runtimeModelPolicyBootstrap_exports2, {
  isTrustedDeploymentManifest: () => isTrustedDeploymentManifest2,
  lookupDeploymentManifest: () => lookupDeploymentManifest2
});
var manifests2 = Object.freeze([]);
function lookupDeploymentManifest2(manifestId, revision) {
  const selected = manifests2.filter((entry) => entry.manifestId === manifestId && entry.revision === revision);
  return selected.length === 1 ? selected[0] : void 0;
}
function isTrustedDeploymentManifest2(manifest) {
  return manifest.classification === "reviewed-actual" && manifests2.some((entry) => entry === manifest);
}

// src/domain/profile.ts
var DEFAULT_EMBEDDING_PROFILE2 = Object.freeze({
  profileId: "cortex-text-small-1536-v1",
  modelId: "openai/text-embedding-3-small",
  dimensions: 1536,
  normalization: "text-nfc-lf-v1",
  chunking: "codepoint-1600-overlap-200-v1",
  indexName: "by_default_embedding_v1"
});
var DEFAULT_VECTOR_FILTER_FIELDS2 = Object.freeze([
  "tenantId",
  "memorySpaceId",
  "profileId"
]);
export {
  runtimeModelPolicyBootstrap_exports2 as production,
  DEFAULT_EMBEDDING_PROFILE2 as profile,
  runtimeModelPolicyBootstrap_exports as synthetic
};
