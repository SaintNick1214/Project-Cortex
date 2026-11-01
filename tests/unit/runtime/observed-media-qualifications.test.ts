/** Source registration checks, never substitutes for the separately pinned
 * genuine native observations or claims unavailable async video acceptance. */
import { describe, expect, it, jest } from "@jest/globals";
import { DEFAULT_GATEWAY_POLICY_MANIFEST, AGENT_GATEWAY_POLICY_MANIFEST_V5, TEXT_GATEWAY_POLICY_MANIFEST_V3 } from "../../../convex-dev/runtimeGatewayQualifications";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V14 } from "../../../convex-dev/runtimeGatewayMediaQualifications";
import { lookupDeploymentManifest, isTrustedDeploymentManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { DeploymentPolicyManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { canonicalModelJson, resolveModelPolicy } from "../../../src/domain/model-policy";
import type { ModelOperationKey } from "../../../src/domain/model-policy";
import { AGENT_NATIVE_TOOLS_V2 } from "../../../src/domain/agent-tools";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";
import { ensureBudget, installDeploymentPolicy, resolve } from "../../../convex-dev/runtimeModelPolicy";
const current: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V14;
const scope = { tenantId: "registration-test", memorySpaceId: "registration-test", principalId: "registration-test", principalVersion: 1,
  membershipId: "registration-test", membershipVersion: 1, grantId: "registration-test", grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
const select = (operationKey: ModelOperationKey) => resolveModelPolicy({ context: { scope, operationKey, runBudgetId: "registration-test", authorizedOverrides: [] },
  policies: current.policies.filter(policy => !("operationKey" in policy) || policy.operationKey === operationKey), qualifications: current.qualifications });
describe("observed native manifest14 registration", () => {
  it("retains exact historical lookup and every original qualification/proof object", () => {
    for (const original of [DEFAULT_GATEWAY_POLICY_MANIFEST, AGENT_GATEWAY_POLICY_MANIFEST_V5, TEXT_GATEWAY_POLICY_MANIFEST_V3]) {
      expect(lookupDeploymentManifest(original.manifestId, original.revision)).toBe(original);
    }
    DEFAULT_GATEWAY_POLICY_MANIFEST.qualifications.forEach((qualification, i) => expect(current.qualifications[i]).toBe(qualification));
    DEFAULT_GATEWAY_POLICY_MANIFEST.dispatchEvidence.forEach((proof, i) => expect(current.dispatchEvidence[i]).toBe(proof));
    expect(lookupDeploymentManifest(current.manifestId, 14)).toBe(current); expect(isTrustedDeploymentManifest(current)).toBe(true);
    expect(new Set(current.qualifications.map(entry => canonicalModelJson([entry.modelId, entry.nativeInterface, entry.priceRevision, entry.boundRevision]))).size).toBe(current.qualifications.length);
  });
  it("registered monotone install preserves prior accounts and resolves fresh selected evidence after unused historical expiry", async () => {
    const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run"];
    const install = registeredHandler<{ manifestId: string; expectedRevision: number }, unknown>(installDeploymentPolicy);
    const bind = registeredHandler<{ reference: typeof f.reference; operationKey: "agent.respond"; requestId: string; requestCanonical: string }, { runBudgetId: string }>(ensureBudget);
    const read = registeredHandler<{ reference: typeof f.reference; operationKey: "agent.respond"; runBudgetId: string }, { snapshot: { qualificationReceiptId: string } }>(resolve);
    const time = jest.spyOn(Date, "now").mockReturnValue(1791533560830);
    try {
      await install(f.ctx, { manifestId: DEFAULT_GATEWAY_POLICY_MANIFEST.manifestId, expectedRevision: 9 });
      const budget = await bind(f.ctx, { reference: f.reference, operationKey: "agent.respond", requestId: "historical-account", requestCanonical: canonicalModelJson({ text: "fixture" }) });
      const accounts = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
      time.mockReturnValue(1791535812384);
      await install(f.ctx, { manifestId: current.manifestId, expectedRevision: 14 });
      expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(accounts);
      const selected = await read(f.ctx, { reference: f.reference, operationKey: "agent.respond", runBudgetId: budget.runBudgetId });
      expect(selected.snapshot.qualificationReceiptId).toBe("ACTUAL-agent-v2-generate-stream-20261009");
      const writes = f.db.writes; await install(f.ctx, { manifestId: current.manifestId, expectedRevision: 14 });
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(accounts);
    } finally { time.mockRestore(); }
  });
  it("selects the exact observed V2 five-tool native contract with two bounded model steps", () => {
    const snapshot = select("agent.respond"), proof = current.dispatchEvidence.find(entry => entry.receiptId === snapshot.qualificationReceiptId)!;
    expect(snapshot.qualificationReceiptId).toBe("ACTUAL-agent-v2-generate-stream-20261009");
    expect(snapshot.allowedTools).toEqual(AGENT_NATIVE_TOOLS_V2.map(tool => tool.name));
    expect(snapshot.limits).toMatchObject({ operationBudgetUnits: 100000, runBudgetUnits: 3000000, outputTokens: 256, toolSteps: 1 });
    expect(proof.toolContract?.toolsCanonical).toBe(canonicalModelJson(AGENT_NATIVE_TOOLS_V2));
    expect(proof.supportsStream).toBe(true); expect(proof.terminalCost).toBe("unavailable");
    expect(proof.checkedAt).toBe(1791509851763); expect(proof.expiresAt).toBe(1791596251763);
    expect(snapshot.fallbackCandidates).toEqual([]);
  });
  it("preserves requested-only image identity, full ceiling and private byte bounds without async authority", () => {
    const snapshot = select("media.image.generate"), proof = current.dispatchEvidence.find(entry => entry.receiptId === snapshot.qualificationReceiptId)!;
    expect(snapshot.modelId).toBe("openai/gpt-image-1"); expect(snapshot.costBound.maximumCostUnits).toBe(2000000);
    expect(proof.mediaContract).toMatchObject({ options: { kind: "image", n: 1, size: "1024x1024", quality: "low", outputFormat: "png" },
      terminalIdentity: "requested-only", maximumResultBytes: 20000000, callbacks: false, inputProtocol: "none" });
    expect(proof.terminalCost).toBe("unavailable"); expect(proof.resultBound.maximumPrivateResultBytes).toBe(60000);
    expect(proof.expiresAt).toBe(1791591452086);
    expect(() => select("media.video.generate")).toThrow("CAPABILITY_UNAVAILABLE");
    expect(current.qualifications.some(entry => entry.nativeInterface === "video")).toBe(false);
  });
  it("selects only genuinely renewed extraction and small memory/query receipts", () => {
    for (const operation of ["memory.extract", "embedding.memory", "embedding.query"] as const) {
      const snapshot = select(operation), proof = current.dispatchEvidence.find(entry => entry.receiptId === snapshot.qualificationReceiptId)!;
      expect(snapshot.qualificationReceiptId).toMatch(/^ACTUAL-(memory-extract|small1536-memory-query)-20261009$/);
      expect(proof.checkedAt).toBeGreaterThan(1791533000000); expect(proof.expiresAt - proof.checkedAt).toBe(86400000);
      expect(proof.terminalCost).toBe("unavailable"); expect(snapshot.costBound.maximumCostUnits).toBe(100000);
      if (operation.startsWith("embedding")) expect(snapshot.semanticProfile).toMatchObject({ dimensions: 1536, indexName: "by_default_embedding_v1" });
    }
    const title = select("conversation.title"), titleProof = current.dispatchEvidence.find(entry => entry.receiptId === title.qualificationReceiptId)!;
    expect(title.qualificationReceiptId).toBe("ACTUAL-ci-conversation-title-20261009"); expect(title.modelId).toBe("openai/gpt-4o");
    expect(titleProof.checkedAt).toBe(1791526119789); expect(titleProof.expiresAt).toBe(1791612519789);
    expect(titleProof.terminalCost).toBe("unavailable"); expect(titleProof.inputBound.featureEnvelope).toBe("plain-chat-v1");
    const unresolved = select("facts.resolve");
    expect(DEFAULT_GATEWAY_POLICY_MANIFEST.qualifications.some(entry => entry.receiptId === unresolved.qualificationReceiptId)).toBe(true);
  });
});
