/** Controlled registered-handler/resolver checks. Actual native evidence is bound by the compiled observations. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { createHash } from "node:crypto";
import { RELEASE_GATEWAY_POLICY_MANIFEST_V19 as current, RELEASE_GATEWAY_POLICY_V19_OBSERVATIONS as observed } from "../../../convex-dev/runtimeGatewayReleaseQualifications";
import { DEFAULT_GATEWAY_POLICY_MANIFEST, AGENT_GATEWAY_POLICY_MANIFEST_V5, TEXT_GATEWAY_POLICY_MANIFEST_V3 } from "../../../convex-dev/runtimeGatewayQualifications";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15, OBSERVED_GATEWAY_POLICY_MANIFEST_V16,
  OBSERVED_GATEWAY_POLICY_MANIFEST_V17, OBSERVED_GATEWAY_POLICY_MANIFEST_V18 } from "../../../convex-dev/runtimeGatewayMediaQualifications";
import { isTrustedDeploymentManifest, lookupDeploymentManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { canonicalModelJson, MEMORY_JSON_SCHEMA_CONTRACT, MODEL_OPERATION_KEYS, resolveModelPolicy } from "../../../src/domain/model-policy";
import type { ModelOperationKey, ModelPolicySnapshotV1, TrustedModelPolicyRecord } from "../../../src/domain/model-policy";
import { AGENT_NATIVE_TOOLS, AGENT_NATIVE_TOOLS_V2 } from "../../../src/domain/agent-tools";
import * as ledger from "../../../convex-dev/runtimeModelPolicy";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";

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
    expect(isTrustedDeploymentManifest({ ...current })).toBe(false); expect(lookupDeploymentManifest(manifest.manifestId, 20)).toBeUndefined();
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
