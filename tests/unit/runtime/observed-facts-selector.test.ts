/** Controlled registered-handler checks. Actual conflict decisions and service
 * installation are qualified separately by the current authenticated CI lane. */
import { describe, expect, it, jest } from "@jest/globals";
import { DEFAULT_GATEWAY_POLICY_MANIFEST, AGENT_GATEWAY_POLICY_MANIFEST_V5, TEXT_GATEWAY_POLICY_MANIFEST_V3 } from "../../../convex-dev/runtimeGatewayQualifications";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15 } from "../../../convex-dev/runtimeGatewayMediaQualifications";
import { lookupDeploymentManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { ensureBudget, installDeploymentPolicy, resolve } from "../../../convex-dev/runtimeModelPolicy";
import { canonicalModelJson, resolveModelPolicy } from "../../../src/domain/model-policy";
import type { ModelOperationKey, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";

const historical: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V14;
const current: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V15;
const afterHistoricalExpiry = 1791535812384;
const scope = { tenantId: "selector-test", memorySpaceId: "selector-test", principalId: "selector-test", principalVersion: 1,
  membershipId: "selector-test", membershipVersion: 1, grantId: "selector-test", grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
function select(manifest: DeploymentPolicyManifest, operationKey: ModelOperationKey) {
  return resolveModelPolicy({ context: { scope, operationKey, runBudgetId: "selector-test", authorizedOverrides: [] },
    policies: manifest.policies.filter(policy => !policy.operationKey || policy.operationKey === operationKey), qualifications: manifest.qualifications });
}
function fixture() {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run"];
  const install = registeredHandler<{ manifestId: string; expectedRevision: number }, unknown>(installDeploymentPolicy);
  const bind = registeredHandler<{ reference: typeof f.reference; operationKey: "facts.resolve"; requestId: string; requestCanonical: string }, { runBudgetId: string; runAccountId: string }>(ensureBudget);
  const read = registeredHandler<{ reference: typeof f.reference; operationKey: "facts.resolve"; runBudgetId: string;
    source: { sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string } },
    { snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence }>(resolve);
  const installRevision = (revision: number) => install(f.ctx, { manifestId: current.manifestId, expectedRevision: revision });
  const bindRequest = (requestId: string) => bind(f.ctx, { reference: f.reference, operationKey: "facts.resolve", requestId,
    requestCanonical: canonicalModelJson({ sourceId: "source", stage: "facts" }) });
  const source = async () => {
    const contentHash = await semanticHash("Owned conflict context");
    f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
      lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" },
      content: "Owned conflict context", contentHash, createdAt: Date.now() });
    return { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash };
  };
  return { ...f, installRevision, bindRequest, source, read };
}
function expectNoModelEffects(f: ReturnType<typeof fixture>) {
  expect(f.db.table("runtimeModelOperations")).toEqual([]);
  expect(f.db.table("runtimeModelAttempts")).toEqual([]);
}

describe("observed facts selector successor15", () => {
  it("preserves historical manifests and all proof objects; only generic selector rules and successor policy identities change", () => {
    for (const original of [DEFAULT_GATEWAY_POLICY_MANIFEST, AGENT_GATEWAY_POLICY_MANIFEST_V5, TEXT_GATEWAY_POLICY_MANIFEST_V3, historical]) {
      expect(lookupDeploymentManifest(original.manifestId, original.revision)).toBe(original);
    }
    expect(lookupDeploymentManifest(current.manifestId, 15)).toBe(current);
    expect(current.qualifications).toBe(historical.qualifications);
    expect(current.dispatchEvidence).toBe(historical.dispatchEvidence);
    expect(current.policies).toHaveLength(historical.policies.length);
    current.policies.forEach((policy, i) => {
      const previous = historical.policies[i]!;
      expect(policy.policyId).toBe(previous.policyId.replace(/-v14$/, "-v15")); expect(policy.version).toBe(15);
      if (policy.operationKey && policy.operationKey !== "facts.resolve") expect(policy.rules).toBe(previous.rules);
      else expect(policy.rules).toEqual({ ...previous.rules, pins: { ...previous.rules.pins,
        priceRevision: "gateway-2026-10-09-observed-default", boundRevision: "text-8192-512-schema-observed-20261009" } });
    });
  });
  it("selects the same fresh generic structured chat contract while retaining the conflict semantic pins", () => {
    const facts = select(current, "facts.resolve"), extract = select(current, "memory.extract");
    expect(facts.qualificationReceiptId).toBe("ACTUAL-memory-extract-20261009");
    expect(facts.qualificationReceiptId).toBe(extract.qualificationReceiptId);
    expect(facts).toMatchObject({ modelId: "openai/gpt-4o-mini", nativeInterface: "chat", capabilities: ["text", "structured"],
      pins: { schemaVersion: "conflicts-v1", promptVersion: "memory-schema-prompt-v2", priceRevision: "gateway-2026-10-09-observed-default",
        boundRevision: "text-8192-512-schema-observed-20261009" },
      limits: { inputTokens: 8192, contextTokens: 16384, outputTokens: 512, operationBudgetUnits: 200000 },
      costBound: { maximumCostUnits: 100000 } });
    const proof = current.dispatchEvidence.find(entry => entry.receiptId === facts.qualificationReceiptId)!;
    expect(proof).toMatchObject({ inputBound: { ruleId: "plain-chat-cookbook-utf8-v1", featureEnvelope: "plain-chat-v1" },
      resultBound: { maximumPrivateResultBytes: 60000, maximumOutputTokens: 512 }, terminalCost: "unavailable" });
    expect(() => select(current, "media.video.generate")).toThrow("CAPABILITY_UNAVAILABLE");
  });
  it("keeps the V14 expired facts selector refusing resolution and new binding before any write or model effect", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(1791533560830);
    try {
      await f.installRevision(14); const budget = await f.bindRequest("historical"); const source = await f.source();
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
      time.mockReturnValue(afterHistoricalExpiry);
      await expect(f.read(f.ctx, { reference: f.reference, operationKey: "facts.resolve", runBudgetId: budget.runBudgetId, source })).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      await expect(f.bindRequest("not-admitted")).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
  it("installs monotonically without changing historical account roots, uncertainty, windows or counters", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(1791533560830);
    try {
      await f.installRevision(14); await f.bindRequest("retained-account");
      f.db.table("runtimeBudgetAccounts").forEach(row => { row.uncertainUnits = 100000; row.activeConcurrency = 1; });
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
      time.mockReturnValue(afterHistoricalExpiry); await f.installRevision(15);
      expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
      const writes = f.db.writes;
      await expect(f.bindRequest("cannot-reset-tenant")).rejects.toThrow("BUDGET_EXCEEDED");
      await f.installRevision(15);
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
  it("resolves fresh selected facts proof for a current owned source and reuses the same budget without new effects", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(afterHistoricalExpiry);
    try {
      await f.installRevision(15); const budget = await f.bindRequest("fresh-facts"); const source = await f.source();
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
      const result = await f.read(f.ctx, { reference: f.reference, operationKey: "facts.resolve", runBudgetId: budget.runBudgetId, source });
      expect(result.snapshot.qualificationReceiptId).toBe("ACTUAL-memory-extract-20261009");
      expect(result.dispatchEvidence).toBe(current.dispatchEvidence.find(proof => proof.receiptId === result.snapshot.qualificationReceiptId));
      expect(await f.bindRequest("fresh-facts")).toEqual(budget);
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
  it("refuses the selected fresh proof at its real expiry with no reservation or account mutation", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(afterHistoricalExpiry);
    try {
      await f.installRevision(15); const budget = await f.bindRequest("before-expiry"); const source = await f.source();
      const proof = current.dispatchEvidence.find(entry => entry.receiptId === "ACTUAL-memory-extract-20261009")!;
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
      time.mockReturnValue(proof.expiresAt);
      await expect(f.read(f.ctx, { reference: f.reference, operationKey: "facts.resolve", runBudgetId: budget.runBudgetId, source })).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      await expect(f.bindRequest("expired-not-admitted")).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
});
