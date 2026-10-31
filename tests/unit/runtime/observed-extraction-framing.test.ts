/** Controlled policy handlers; the successor does not qualify native JSON output. */
import { describe, expect, it, jest } from "@jest/globals";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V16, OBSERVED_GATEWAY_POLICY_MANIFEST_V17 } from "../../../convex-dev/runtimeGatewayMediaQualifications";
import { lookupDeploymentManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { ensureBudget, installDeploymentPolicy, resolve } from "../../../convex-dev/runtimeModelPolicy";
import { canonicalModelJson, resolveModelPolicy } from "../../../src/domain/model-policy";
import type { ModelOperationKey, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { semanticHash } from "../../../src/domain/profile";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";

const historical: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V16;
const current: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V17;
const now = 1791546000000;
const scope = { tenantId: "framing-test", memorySpaceId: "framing-test", principalId: "framing-test", principalVersion: 1,
  membershipId: "framing-test", membershipVersion: 1, grantId: "framing-test", grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
function select(manifest: DeploymentPolicyManifest, operationKey: ModelOperationKey) {
  return resolveModelPolicy({ context: { scope, operationKey, runBudgetId: "framing-test", authorizedOverrides: [] },
    policies: manifest.policies.filter(policy => !policy.operationKey || policy.operationKey === operationKey), qualifications: manifest.qualifications });
}
function fixture() {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run"];
  const install = registeredHandler<{ manifestId: string; expectedRevision: number }, unknown>(installDeploymentPolicy);
  const bind = registeredHandler<{ reference: typeof f.reference; operationKey: "memory.extract"; requestId: string; requestCanonical: string },
    { runBudgetId: string; runAccountId: string }>(ensureBudget);
  const read = registeredHandler<{ reference: typeof f.reference; operationKey: "memory.extract"; runBudgetId: string;
    source: { sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string } },
    { snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence }>(resolve);
  const installRevision = (revision: number) => install(f.ctx, { manifestId: current.manifestId, expectedRevision: revision });
  const bindRequest = (requestId: string) => bind(f.ctx, { reference: f.reference, operationKey: "memory.extract", requestId,
    requestCanonical: canonicalModelJson({ sourceId: "source", stage: "extract" }) });
  const source = async () => {
    const contentHash = await semanticHash("Owned extraction evidence");
    f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      ownerPrincipalId: f.reference.principalId, lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1,
        role: "user", trust: "user_assertion" }, content: "Owned extraction evidence", contentHash, createdAt: Date.now() });
    return { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash };
  };
  return { ...f, installRevision, bindRequest, source, read };
}

describe("immutable extraction framing successor17", () => {
  it("adds the v4 extraction pin while retaining v16 and every actual proof, expiry, price and other semantic rule", () => {
    expect(lookupDeploymentManifest(historical.manifestId, 16)).toBe(historical);
    expect(lookupDeploymentManifest(current.manifestId, 17)).toBe(current);
    expect(current.qualifications).toBe(historical.qualifications); expect(current.dispatchEvidence).toBe(historical.dispatchEvidence);
    expect(current.budgetWindowMs).toBe(historical.budgetWindowMs); expect(current.policies).toHaveLength(historical.policies.length);
    current.policies.forEach((policy, index) => {
      const previous = historical.policies[index]!;
      expect(policy.policyId).toBe(previous.policyId.replace(/-v16$/, "-v17")); expect(policy.version).toBe(17);
      if (policy.operationKey === "memory.extract") expect(policy.rules).toEqual({ ...previous.rules,
        pins: { ...previous.rules.pins, promptVersion: "memory-extraction-framed-prompt-v4" } });
      else expect(policy.rules).toBe(previous.rules);
    });
    expect(select(historical, "memory.extract").pins.promptVersion).toBe("memory-extraction-instance-prompt-v3");
    const old = select(historical, "memory.extract"), next = select(current, "memory.extract");
    expect(next).toMatchObject({ nativeInterface: "chat", qualificationReceiptId: "ACTUAL-memory-extract-20261009",
      modelId: "openai/gpt-4o-mini", pins: { promptVersion: "memory-extraction-framed-prompt-v4", schemaVersion: "facts-v1" } });
    expect(next.limits).toEqual(old.limits); expect(next.costBound).toEqual(old.costBound);
    for (const key of ["facts.resolve", "conversation.title", "memory.summarize", "artifact.text"] as const) {
      expect(select(current, key).pins).toEqual(select(historical, key).pins);
    }
  });

  it("installs16→17 without changing retained financial roots, holds or allowing reset", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      await f.installRevision(16); await f.bindRequest("retained");
      f.db.table("runtimeBudgetAccounts").forEach(row => { row.uncertainUnits = 100000; row.activeConcurrency = 1; });
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
      await f.installRevision(17); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
      const writes = f.db.writes; await expect(f.bindRequest("cannot-reset")).rejects.toThrow("BUDGET_EXCEEDED");
      await f.installRevision(17); expect(f.db.writes).toBe(writes);
      expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
      expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    } finally { time.mockRestore(); }
  });

  it("resolves the registered v4 pin with the existing plain-chat proof and no model/reservation effects", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      await f.installRevision(17); const budget = await f.bindRequest("framed"), source = await f.source();
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
      const result = await f.read(f.ctx, { reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId, source });
      expect(result.snapshot.pins.promptVersion).toBe("memory-extraction-framed-prompt-v4");
      expect(result.dispatchEvidence).toBe(current.dispatchEvidence.find(proof => proof.receiptId === "ACTUAL-memory-extract-20261009"));
      expect(result.dispatchEvidence.inputBound.featureEnvelope).toBe("plain-chat-v1");
      expect(await f.bindRequest("framed")).toEqual(budget); expect(f.db.writes).toBe(writes);
      expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expect(f.db.table("runtimeModelOperations")).toEqual([]);
    } finally { time.mockRestore(); }
  });

  it("still denies expired proof, revoked grants and stale sources before any model effects", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      await f.installRevision(17); const budget = await f.bindRequest("before-expiry"), source = await f.source();
      const writes = f.db.writes;
      await expect(f.read(f.ctx, { reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId,
        source: { ...source, contentHash: "a".repeat(64) } })).rejects.toThrow();
      f.grant.revokedAt = now;
      await expect(f.read(f.ctx, { reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId, source })).rejects.toThrow();
      delete f.grant.revokedAt;
      time.mockReturnValue(current.dispatchEvidence.find(proof => proof.receiptId === "ACTUAL-memory-extract-20261009")!.expiresAt);
      await expect(f.read(f.ctx, { reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId, source })).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      await expect(f.bindRequest("expired")).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    } finally { time.mockRestore(); }
  });
});
