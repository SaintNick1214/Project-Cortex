/** Controlled registered-handler/resolver checks. Actual native evidence is bound by the compiled observations. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createHash } from "node:crypto";
import { RELEASE_GATEWAY_POLICY_MANIFEST_V19 as current, RELEASE_GATEWAY_POLICY_V19_OBSERVATIONS as observed } from "../../../convex-dev/runtimeGatewayReleaseQualifications";
import { DEFAULT_GATEWAY_POLICY_MANIFEST, AGENT_GATEWAY_POLICY_MANIFEST_V5, TEXT_GATEWAY_POLICY_MANIFEST_V3 } from "../../../convex-dev/runtimeGatewayQualifications";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15, OBSERVED_GATEWAY_POLICY_MANIFEST_V16,
  OBSERVED_GATEWAY_POLICY_MANIFEST_V17, OBSERVED_GATEWAY_POLICY_MANIFEST_V18 } from "../../../convex-dev/runtimeGatewayMediaQualifications";
import { isTrustedDeploymentManifest, lookupDeploymentManifest, qualifiedTerminalModelId } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { canonicalModelJson, MEMORY_JSON_SCHEMA_CONTRACT, MODEL_OPERATION_KEYS, resolveModelPolicy } from "../../../src/domain/model-policy";
import type { ModelCallRequest, ModelOperationKey, ModelPolicySnapshotV1, TrustedModelPolicyRecord } from "../../../src/domain/model-policy";
import { AGENT_NATIVE_TOOLS, AGENT_NATIVE_TOOLS_V2 } from "../../../src/domain/agent-tools";
import * as ledger from "../../../convex-dev/runtimeModelPolicy";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";
import { RELEASE_GATEWAY_POLICY_MANIFEST_V20 as renewed, RELEASE_GATEWAY_POLICY_V20_OBSERVATIONS as renewal } from "../../../convex-dev/runtimeGatewayReleaseQualificationsV20";
import { semanticHash } from "../../../src/domain/profile";
import { FACTS_JSON_SCHEMA } from "../../../src/domain/extraction";
import type { SourceContent } from "../../../src/domain/contracts";
import { buildSourceExtractionFramingV6 } from "../../../convex-dev/runtimeMemoryGateway";


const manifest: DeploymentPolicyManifest = current;
const now = Math.max(...manifest.dispatchEvidence.map(proof => proof.checkedAt)) + 1000;
beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(now); });
afterEach(() => { jest.restoreAllMocks(); });
const historical = [TEXT_GATEWAY_POLICY_MANIFEST_V3, AGENT_GATEWAY_POLICY_MANIFEST_V5, DEFAULT_GATEWAY_POLICY_MANIFEST,
  OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15, OBSERVED_GATEWAY_POLICY_MANIFEST_V16,
  OBSERVED_GATEWAY_POLICY_MANIFEST_V17, OBSERVED_GATEWAY_POLICY_MANIFEST_V18];
function select(operationKey: ModelOperationKey, policies = manifest.policies, qualifications = manifest.qualifications) {
  return resolveModelPolicy({ context: { scope: memoryFixture().reference, operationKey, runBudgetId: "successor19-control", authorizedOverrides: [] },
    policies: policies.filter(policy => !policy.operationKey || policy.operationKey === operationKey), qualifications });
}
async function fixture() {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run", "tool", "storage:write", "storage:read"];
  const invoke = <T = unknown>(name: keyof typeof ledger, args: unknown) =>
    f.db.transaction(() => registeredHandler<unknown, T>(ledger[name])(f.ctx, args));
  const install = (revision = 19) => invoke("installDeploymentPolicy", { manifestId: manifest.manifestId, expectedRevision: revision });
  const bind = (requestId: string) => invoke<{ runBudgetId: string }>("ensureBudget", { reference: f.reference,
    operationKey: "artifact.text", requestId, requestCanonical: canonicalModelJson({ text: "controlled successor19" }) });
  return { ...f, invoke, install, bind };
}

describe("actual release qualification successor19", () => {
  it("registers the exact same-lineage object while retaining all eight historical roots and dates", () => {
    expect(manifest.manifestId).toBe("cortex-gateway-agent-defaults-2026-10-08"); expect(manifest.revision).toBe(19);
    expect(lookupDeploymentManifest(manifest.manifestId, 19)).toBe(current); expect(isTrustedDeploymentManifest(current)).toBe(true);
    expect(isTrustedDeploymentManifest({ ...current })).toBe(false); expect(lookupDeploymentManifest(manifest.manifestId, 21)).toBeUndefined();
    expect(historical.map(root => ({ revision: root.revision, sha256: createHash("sha256").update(JSON.stringify(root)).digest("hex") })))
      .toEqual(observed.historicalRoots.map(root => ({ revision: root.revision, sha256: root.sha256 })));
    for (const root of historical) expect(lookupDeploymentManifest(root.manifestId, root.revision)).toBe(root);
    expect(observed.evidenceReviewSha256).toBe(manifest.acceptanceHash);
    expect(observed.finalCoherentCodeReviewRepresentedByAcceptanceHash).toBe(false);
  });

  it("resolves twelve nonvideo defaults with2M generic/title/embedding and3M V2/image caps", () => {
    const operations = MODEL_OPERATION_KEYS.filter(key => key !== "media.video.generate"); expect(operations).toHaveLength(12);
    for (const operation of operations) {
      const snapshot = select(operation);
      expect(snapshot.limits.runBudgetUnits).toBe(operation === "agent.respond" || operation === "media.image.generate" ? 3000000 : 2000000);
      expect(snapshot.limits.tenantBudgetUnits).toBe(10000000); expect(snapshot.limits.concurrency).toBe(2);
      expect(snapshot.fallbackCandidates).toEqual([]); expect(snapshot.allowedOptions).toEqual([]);
    }
    expect(select("conversation.title").modelId).toBe("openai/gpt-4o");
    const extract = select("memory.extract");
    expect(extract.pins).toMatchObject({ boundRevision: MEMORY_JSON_SCHEMA_CONTRACT.boundRevision, promptVersion: MEMORY_JSON_SCHEMA_CONTRACT.promptVersion });
    expect(extract.allowedTools).toEqual([]);
    expect(manifest.dispatchEvidence.find(proof => proof.receiptId === extract.qualificationReceiptId)?.inputBound.featureEnvelope).toBe("memory-extract-json-schema-v1");
    expect(select("agent.respond").allowedTools).toEqual(AGENT_NATIVE_TOOLS_V2.map(tool => tool.name));
    expect(() => select("media.video.generate")).toThrow("CAPABILITY_UNAVAILABLE");
  });

  it("preserves all nine supported V16 aliases including stream-only V1 and current remote V2", () => {
    const old = OBSERVED_GATEWAY_POLICY_MANIFEST_V16;
    for (const alias of old.qualifications.filter(q => q.modelId !== "openai/gpt-image-1")) {
      const q = manifest.qualifications.find(q => q.modelId === alias.modelId && q.boundRevision === alias.boundRevision)!;
      expect(q).toBeDefined(); expect(q.limits).toEqual(alias.limits); expect(q.allowedOptions).toEqual(alias.allowedOptions);
      const proof = manifest.dispatchEvidence.find(p => p.receiptId === q.receiptId)!;
      const hard: TrustedModelPolicyRecord = JSON.parse(JSON.stringify(manifest.policies.find(p => !p.operationKey)));
      Object.assign(hard.rules, { modelId: q.modelId, nativeInterface: q.nativeInterface, allowedModels: [q.modelId],
        capabilities: [...q.capabilities], allowedOptions: [], allowedTools: proof.toolContract ? JSON.parse(proof.toolContract.toolsCanonical).map((tool: { name: string }) => tool.name) : [],
        fallbackModels: [], limits: { ...q.limits }, pins: { ...hard.rules.pins, priceRevision: q.priceRevision, boundRevision: q.boundRevision,
          toolRegistryVersion: proof.toolContract?.registryVersion ?? "none-v1" } });
      expect(select(q.nativeInterface === "embedding" ? "embedding.query" : q.capabilities.includes("tools") ? "agent.respond" : "artifact.text", [hard], [q]).limits).toEqual(alias.limits);
    }
    const v1 = manifest.qualifications.find(q => q.boundRevision === "agent-tools-32768-512-v1")!;
    const proof = manifest.dispatchEvidence.find(p => p.receiptId === v1.receiptId)!;
    expect(v1.limits.runBudgetUnits).toBe(2000000); expect(proof.supportsStream).toBe(true);
    expect(JSON.parse(proof.toolContract!.toolsCanonical)).toEqual(AGENT_NATIVE_TOOLS);
    expect(observed.v1).toMatchObject({ streamObserved: true, generationSeparatelyObserved: false, toolEffectsExecuted: false });
    expect(manifest.qualifications.find(q => q.boundRevision === "agent-tools-v2-32768-256-shared3m-v1")?.limits.runBudgetUnits).toBe(3000000);
  });

  it("binds flare only to its new contract, retaining old image retirement and UNKNOWN accounting", () => {
    expect(manifest.qualifications.some(q => q.modelId === "openai/gpt-image-1")).toBe(false);
    expect(manifest.dispatchEvidence.some(p => p.modelId === "openai/gpt-image-1")).toBe(false);
    const image = select("media.image.generate"), proof = manifest.dispatchEvidence.find(p => p.receiptId === image.qualificationReceiptId)!;
    expect(image.modelId).toBe("openai/gpt-image-2.5-flare"); expect(image.pins.boundRevision).toBe("image25-flare-1024-low-png-v1");
    expect(image.costBound.maximumCostUnits).toBe(2000000); expect(proof.mediaContract).toMatchObject({ terminalIdentity: "requested-only", maximumResultBytes: 20000000,
      options: { n: 1, size: "1024x1024", quality: "low", outputFormat: "png" } });
    expect(observed.image).toMatchObject({ bytes: 700695, sha256: "10cd440e99cb38d4df81e0ea768c2704463780729e1e29d3bb8a028b31a67857", evidenceRenewsRetiredModel: false });
    expect(observed.actualUsdSettlementClaim).toBe(false); expect(observed.originalImageUpstreamOutcome).toBe("UNKNOWN");
    for (const proof of manifest.dispatchEvidence) expect(proof.terminalCost).toBe("unavailable");
  });

  it("installs native registered policy without model effects and refuses expired evidence without creating a budget", async () => {
    const f = await fixture(); await f.install();
    expect(f.db.table("runtimeModelAttempts")).toEqual([]); expect(f.db.table("runtimeBudgetAccounts")).toEqual([]);
    const budget = await f.bind("successor19");
    const resolved = await f.invoke<{ snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence }>("resolve", {
      reference: f.reference, operationKey: "artifact.text", runBudgetId: budget.runBudgetId });
    expect(resolved.snapshot.limits.runBudgetUnits).toBe(2000000); expect(resolved.dispatchEvidence.expiresAt).toBeGreaterThan(now);
    expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    jest.spyOn(Date, "now").mockReturnValue(Math.max(...manifest.dispatchEvidence.map(p => p.expiresAt)) + 1);
    const money = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    await expect(f.bind("expired-no-budget")).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(money);
  });

  it("monotone installation cannot refund or replace retained old UNKNOWN accounts", async () => {
    const f = await fixture(); jest.spyOn(Date, "now").mockReturnValue(1791546000000);
    await f.install(16); await f.bind("old-window");
    f.db.table("runtimeBudgetAccounts").forEach(row => { row.uncertainUnits = 100000; row.activeConcurrency = 1; });
    const money = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    jest.spyOn(Date, "now").mockReturnValue(now); await f.install();
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(money);
    await expect(f.bind("no-reset" )).rejects.toThrow("BUDGET_EXCEEDED");
    await expect(f.install(16)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
});

const renewedManifest: DeploymentPolicyManifest = renewed;
const renewalNow = Math.max(...renewedManifest.dispatchEvidence.map(proof => proof.checkedAt)) + 1000;
function renewalSelect(operationKey: ModelOperationKey) {
  return select(operationKey, renewedManifest.policies, renewedManifest.qualifications);
}
function controlledRequest(snapshot: ModelPolicySnapshotV1, semanticId = "controlled-v20"): ModelCallRequest {
  const text = "I prefer jasmine tea.";
  return { semanticId, childCallId: "untrusted-child", texts: [text], messages: [{ role: "user", parts: [{ type: "text", text }] }],
    inputTokens: 1, outputTokens: 20, toolSteps: 0, timeoutMs: 1000, reservationUnits: 1, tools: [], options: { maxRetries: 0 },
    promptVersion: snapshot.pins.promptVersion, schemaVersion: snapshot.pins.schemaVersion,
    extractionVersion: snapshot.pins.extractionVersion, toolRegistryVersion: snapshot.pins.toolRegistryVersion };
}
async function renewedAdmission() {
  const f = await fixture(); await f.install(20); const budget = await f.bind("v20-controlled-native");
  const resolution = await f.invoke<{ snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence }>("resolve", {
    reference: f.reference, operationKey: "artifact.text", runBudgetId: budget.runBudgetId });
  const request = controlledRequest(resolution.snapshot);
  const args = { reference: f.reference, operationKey: "artifact.text", runBudgetId: budget.runBudgetId,
    semanticId: request.semanticId, ordinal: 0, requestCanonical: canonicalModelJson(request) };
  const admitted = await f.invoke<{ attemptId: string; operationId: string; requestCanonical: string }>("admit", args);
  await f.invoke("checkpoint", { reference: f.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical });
  return { ...f, admitted, args, resolution };
}

describe("actual release qualification renewal20", () => {
  beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(renewalNow); });

  it("registers only the exact new object and keeps every original root and V19 object unchanged", () => {
    expect(lookupDeploymentManifest(manifest.manifestId, 19)).toBe(current);
    expect(lookupDeploymentManifest(manifest.manifestId, 20)).toBe(renewed);
    expect(lookupDeploymentManifest(manifest.manifestId, 21)).toBeUndefined();
    expect(isTrustedDeploymentManifest(renewed)).toBe(true); expect(isTrustedDeploymentManifest({ ...renewed })).toBe(false);
    const roots = [...historical, current];
    expect(roots.map(root => ({ manifestId: root.manifestId, revision: root.revision,
      sha256: createHash("sha256").update(JSON.stringify(root)).digest("hex") }))).toEqual(renewal.historicalRoots);
    expect(new Set(renewedManifest.qualifications.map(q => q.receiptId)).size).toBe(16);
    expect(renewedManifest.qualifications.every(q => !manifest.qualifications.some(old => old.receiptId === q.receiptId))).toBe(true);
  });

  it("resolves the same twelve default behaviors and effective caps without adding video or fallback", () => {
    for (const operation of MODEL_OPERATION_KEYS.filter(key => key !== "media.video.generate")) {
      const previous = select(operation), next = renewalSelect(operation);
      expect(next.modelId).toBe(previous.modelId); expect(next.nativeInterface).toBe(previous.nativeInterface);
      expect(next.limits).toEqual(previous.limits); expect(next.costBound.maximumCostUnits).toBe(previous.costBound.maximumCostUnits);
      expect(next.allowedTools).toEqual(previous.allowedTools); expect(next.allowedOptions).toEqual(previous.allowedOptions);
      expect(next.fallbackCandidates).toEqual([]); expect(next.pins.boundRevision).toBe(previous.pins.boundRevision);
      expect(next.limits.runBudgetUnits).toBe(operation === "agent.respond" || operation === "media.image.generate" ? 3000000 : 2000000);
      expect(next.pins.priceRevision).not.toBe(previous.pins.priceRevision);
    }
    expect(renewedManifest.policies.filter(p => p.operationKey)).toHaveLength(12);
    expect(() => renewalSelect("media.video.generate")).toThrow("CAPABILITY_UNAVAILABLE");
    expect(renewalSelect("agent.respond").allowedTools).toEqual(AGENT_NATIVE_TOOLS_V2.map(tool => tool.name));
  });

  it("resolves every original descriptor/alias with identical limits and complete feature/tool/media contracts", () => {
    for (const old of manifest.qualifications) {
      const q = renewedManifest.qualifications.find(q => q.modelId === old.modelId && q.boundRevision === old.boundRevision)!;
      const before = manifest.dispatchEvidence.find(p => p.receiptId === old.receiptId)!;
      const after = renewedManifest.dispatchEvidence.find(p => p.receiptId === q.receiptId)!;
      expect(q.limits).toEqual(old.limits); expect(q.capabilities).toEqual(old.capabilities); expect(q.allowedOptions).toEqual(old.allowedOptions);
      expect(q.costBound.maximumCostUnits).toBe(old.costBound.maximumCostUnits); expect(q.nativeInterface).toBe(old.nativeInterface);
      expect(after.toolContract).toEqual(before.toolContract); expect(after.mediaContract).toEqual(before.mediaContract);
      expect(after.embeddingProfile).toEqual(before.embeddingProfile); expect(after.terminalModelId).toBe(before.terminalModelId);
      expect(after.supportsStream).toBe(before.supportsStream); expect(after.providerVersion).toBe(before.providerVersion);
      expect(after.inputBound.ruleId).toBe(before.inputBound.ruleId); expect(after.inputBound.featureEnvelope).toBe(before.inputBound.featureEnvelope);
      expect(after.inputBound.revision).toBe(before.inputBound.revision);
      expect({ ...after.resultBound, proofHash: before.resultBound.proofHash }).toEqual(before.resultBound);
      const hard: TrustedModelPolicyRecord = JSON.parse(JSON.stringify(renewedManifest.policies.find(p => !p.operationKey)));
      Object.assign(hard.rules, { modelId: q.modelId, nativeInterface: q.nativeInterface, allowedModels: [q.modelId], capabilities: [...q.capabilities],
        allowedOptions: [], allowedTools: after.toolContract ? JSON.parse(after.toolContract.toolsCanonical).map((t: { name: string }) => t.name) : [],
        fallbackModels: [], limits: { ...q.limits }, pins: { ...hard.rules.pins, priceRevision: q.priceRevision, boundRevision: q.boundRevision,
          toolRegistryVersion: after.toolContract?.registryVersion ?? "none-v1" } });
      const operation = q.nativeInterface === "image" ? "media.image.generate" : q.nativeInterface === "embedding" ? "embedding.query"
        : q.capabilities.includes("tools") ? "agent.respond" : "artifact.text";
      expect(select(operation, [hard], [q]).limits).toEqual(old.limits);
    }
  });

  it("binds actual raw times and both V2 methods, with conservative lease expiry and separate evidence acceptance", () => {
    const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
    expect(digest(renewal.sourceArtifactBinding)).toBe(renewedManifest.artifactRevision);
    expect(digest(renewal.evidenceBinding)).toBe(renewedManifest.evidenceHash);
    expect(renewedManifest.acceptanceHash).toBe(renewal.evidenceReview.sha256);
    expect(renewal.finalCoherentCodeReviewRepresentedByAcceptanceHash).toBe(false);
    expect(renewal.sourceLocalAcceptanceRepresentedByAcceptanceHash).toBe(false);
    expect(renewal.groups.flatMap(g => g.entries.map(e => e.mode))).toEqual(["plain", "title", "small", "large", "toolsGenerate", "toolsStream", "jsonExtract", "v1", "image"]);
    for (const group of renewal.groups) {
      const checkedAt = Math.min(...group.entries.map(e => e.checkedAt));
      const expiry = Math.min(...group.entries.map(e => Math.min(e.checkedAt + 7 * 86400000, renewal.actualLeaseExpiresAt)));
      expect(group.checkedAt).toBe(checkedAt); expect(group.expiresAt).toBe(expiry);
      for (const proof of renewedManifest.dispatchEvidence.filter(p => p.evidenceHash === group.evidenceHash)) {
        expect(proof.checkedAt).toBe(checkedAt); expect(proof.expiresAt).toBe(expiry); expect(proof.terminalCost).toBe("unavailable");
      }
    }
    const v2 = renewal.groups.find(g => g.id === "v2")!; expect(v2.entries.map(e => e.mode)).toEqual(["toolsGenerate", "toolsStream"]);
    expect(v2.checkedAt).toBeLessThan(v2.entries[1]!.checkedAt);
    expect(renewal.originalFailures.sdk.exitCode).toBe(1); expect(renewal.originalFailures.sdk.completed).toEqual([]);
    expect(renewal.originalFailures.cli.exitCode).toBe(1); expect(renewal.currentRecoveredCleanupAccepted).toBe(true);
    expect(renewal.issuedAttempts).toBe(9); expect(renewal.possibleLiabilityUnits).toBe(2800000);
    expect(renewal.separateHistoricalLiability).toMatchObject({ revision: 19, possibleLiabilityUnits: 4800000, issuedAttempts: 10 });
    expect(renewal.actualUsdSettlementClaim).toBe(false);
  });

  it("retains genuine embedding terminal aliases and requested-only flare while rejecting foreign identities", () => {
    const small = renewedManifest.dispatchEvidence.find(p => p.boundRevision === "manual-small-8192-1536")!;
    const large = renewedManifest.dispatchEvidence.find(p => p.boundRevision === "manual-large-8192-3072")!;
    expect(qualifiedTerminalModelId(small)).toBe("text-embedding-3-small"); expect(qualifiedTerminalModelId(large)).toBe("text-embedding-3-large");
    expect(qualifiedTerminalModelId({ ...small, terminalModelId: "foreign/model" })).toBeUndefined();
    const image = renewalSelect("media.image.generate"), proof = renewedManifest.dispatchEvidence.find(p => p.receiptId === image.qualificationReceiptId)!;
    expect(proof.mediaContract?.terminalIdentity).toBe("requested-only"); expect(proof.terminalModelId).toBeUndefined();
    expect(renewal.image).toMatchObject({ bytes: 1507930, sha256: "bab5c9c4a3a24224f1d2d981ce79ad2d5f10fc02c71e01d2d56566a9f6fdf284",
      mimeType: "image/png", width: 1024, height: 1024, privateDeliveryVerified: true, identity: "requested-only", evidenceRenewsRetiredModel: false });
    expect(renewedManifest.qualifications.some(q => q.modelId === "openai/gpt-image-1")).toBe(false);
    expect(renewal.v1).toEqual({ streamObserved: true, generationSeparatelyObserved: false, toolEffectsExecuted: false });
  });

  it("uses actual registered installation/resolution without attempts and refuses expired evidence before new money", async () => {
    const f = await fixture(); await expect(f.install(21)).rejects.toThrow();
    expect(f.db.table("runtimeModelPolicies")).toEqual([]); expect(f.db.table("runtimeBudgetAccounts")).toEqual([]);
    await f.install(20); const budget = await f.bind("fresh-v20");
    const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    const result = await f.invoke<{ snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence }>("resolve", {
      reference: f.reference, operationKey: "artifact.text", runBudgetId: budget.runBudgetId });
    expect(result.snapshot.qualificationReceiptId).toBe(renewalSelect("artifact.text").qualificationReceiptId);
    expect(result.dispatchEvidence).toBe(renewedManifest.dispatchEvidence.find(p => p.receiptId === result.snapshot.qualificationReceiptId));
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    jest.spyOn(Date, "now").mockReturnValue(renewal.actualLeaseExpiresAt);
    await expect(f.bind("expired-v20-no-new-money")).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expect(f.db.table("runtimeModelOperations")).toEqual([]);
  });

  it("monotone19->20 install retains old UNKNOWN/window and cannot refund, downgrade or bypass its active slot", async () => {
    const f = await fixture(); jest.spyOn(Date, "now").mockReturnValue(now); await f.install(19); await f.bind("retained-v19-window");
    f.db.table("runtimeBudgetAccounts").forEach(row => { row.uncertainUnits = 100000; row.activeConcurrency = 1; });
    const money = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    jest.spyOn(Date, "now").mockReturnValue(renewalNow); await f.install(20);
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(money);
    await expect(f.bind("cannot-reset-at-v20")).rejects.toThrow("BUDGET_EXCEEDED");
    await expect(f.install(19)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(money); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });

  it("actual V20 admission binds full canonical and retains UNKNOWN once after confirmed terminal, never inventing dollars", async () => {
    const f = await renewedAdmission(), attempt = f.db.table("runtimeModelAttempts")[0]!;
    expect(JSON.parse(attempt.canonical as string)).toEqual({ request: JSON.parse(f.admitted.requestCanonical), snapshot: f.resolution.snapshot });
    const terminal = { version: 1, dispatchIdentity: attempt.dispatchIdentity, receiptId: "controlled-v20-unknown-terminal",
      modelId: f.resolution.snapshot.modelId, actualModel: f.resolution.snapshot.modelId, nativeInterface: "chat",
      outcome: "confirmed", proof: "provider-terminal-v1", costSource: "unavailable", usage: { inputTokens: 1, outputTokens: 2 } };
    await f.invoke("settle", { reference: f.reference, attemptId: f.admitted.attemptId, receiptCanonical: canonicalModelJson(terminal) });
    for (const account of f.db.table("runtimeBudgetAccounts")) expect(account).toMatchObject({ uncertainUnits: 100000, settledUnits: 0, reservedUnits: 0, activeConcurrency: 0 });
    const expectedAccounts = f.db.table("runtimeBudgetAccounts").map(account => {
      expect(account.version).toBe(3); return { ...account, version: (account.version as number) + 1 };
    });
    const operations = canonicalModelJson(f.db.table("runtimeModelOperations")), attempts = canonicalModelJson(f.db.table("runtimeModelAttempts"));
    await f.invoke("settle", { reference: f.reference, attemptId: f.admitted.attemptId, receiptCanonical: canonicalModelJson(terminal) });
    expect(f.db.table("runtimeBudgetAccounts")).toEqual(expectedAccounts);
    expect(canonicalModelJson(f.db.table("runtimeModelOperations"))).toBe(operations);
    expect(canonicalModelJson(f.db.table("runtimeModelAttempts"))).toBe(attempts); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });

  it("new V20 proof still withholds foreign-model terminal and preserves the whole uncertain reservation", async () => {
    const f = await renewedAdmission(), attempt = f.db.table("runtimeModelAttempts")[0]!;
    await f.invoke("settle", { reference: f.reference, attemptId: f.admitted.attemptId, receiptCanonical: canonicalModelJson({ version: 1,
      dispatchIdentity: attempt.dispatchIdentity, receiptId: "controlled-v20-foreign-terminal", modelId: f.resolution.snapshot.modelId,
      actualModel: "foreign/model", nativeInterface: "chat", outcome: "confirmed", proof: "provider-terminal-v1", costSource: "unavailable",
      usage: { inputTokens: 1, outputTokens: 2 } }) });
    expect(f.db.table("runtimeModelAttempts")[0]).toMatchObject({ resultWithheld: true, slotReleased: true });
    for (const account of f.db.table("runtimeBudgetAccounts")) expect(account).toMatchObject({ uncertainUnits: 100000, settledUnits: 0, overrun: true });
    const financial = () => canonicalModelJson({ accounts: f.db.table("runtimeBudgetAccounts"),
      operations: f.db.table("runtimeModelOperations"), attempts: f.db.table("runtimeModelAttempts") });
    const before = financial();
    expect(await f.invoke("admit", f.args)).toEqual({ status: "uncertain", attemptId: f.admitted.attemptId,
      operationId: f.admitted.operationId, replayAllowed: false });
    expect(financial()).toBe(before);
    expect(await f.invoke("checkpoint", { reference: f.reference, attemptId: f.admitted.attemptId,
      requestCanonical: f.admitted.requestCanonical })).toEqual({ dispatchPermit: false, state: "uncertain", replayAllowed: false });
    expect(financial()).toBe(before); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });

  it("strict JSON V20 admission requires real source/hash and exact native schema before reserving", async () => {
    const f = await fixture(); await f.install(20);
    const content = "I prefer jasmine tea.", source: SourceContent = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId!,
      ownerPrincipalId: f.reference.principalId, content, contentHash: await semanticHash(content), createdAt: renewalNow,
      lineage: { sourceId: "v20-source", sourceEventId: "v20-source", sourceRevision: 1, role: "user", trust: "user_assertion" } };
    f.db.seed("runtimeMemorySources", source as unknown as Record<string, unknown>);
    const binding = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: 1, contentHash: source.contentHash };
    const budget = await f.invoke<{ runBudgetId: string }>("ensureBudget", { reference: f.reference, operationKey: "memory.extract",
      requestId: "v20-real-source", requestCanonical: canonicalModelJson({ source: binding }) });
    const resolutionArgs = { reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId };
    await expect(f.invoke("resolve", resolutionArgs)).rejects.toThrow("FORBIDDEN");
    const result = await f.invoke<{ snapshot: ModelPolicySnapshotV1 }>("resolve", { ...resolutionArgs, source: binding });
    const framing = buildSourceExtractionFramingV6(source), request: ModelCallRequest = { ...controlledRequest(result.snapshot, "controlled-v20-json"),
      texts: [framing.system, framing.prompt], messages: [{ role: "system", parts: [{ type: "text", text: framing.system }] },
        { role: "user", parts: [{ type: "text", text: framing.prompt }] }], outputTokens: 512,
      outputSchema: FACTS_JSON_SCHEMA, responseFormat: MEMORY_JSON_SCHEMA_CONTRACT.responseFormat };
    const args = { ...resolutionArgs, semanticId: request.semanticId, ordinal: 0, source: binding };
    const money = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    await expect(f.invoke("admit", { ...args, requestCanonical: canonicalModelJson({ ...request, outputSchema: { type: "object" } }) })).rejects.toThrow();
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(money); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    const admitted = await f.invoke<{ status: string }>("admit", { ...args, requestCanonical: canonicalModelJson(request) });
    expect(admitted.status).toBe("reserved"); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
    for (const account of f.db.table("runtimeBudgetAccounts")) expect(account).toMatchObject({ reservedUnits: 100000, activeConcurrency: 1, settledUnits: 0 });
  });
});
