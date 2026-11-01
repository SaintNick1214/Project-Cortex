/** Controlled registered-handler checks; no new model/service qualification. */
import { describe, expect, it, jest } from "@jest/globals";
import { DEFAULT_GATEWAY_POLICY_MANIFEST, AGENT_GATEWAY_POLICY_MANIFEST_V5, TEXT_GATEWAY_POLICY_MANIFEST_V3 } from "../../../convex-dev/runtimeGatewayQualifications";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15, OBSERVED_GATEWAY_POLICY_MANIFEST_V16 } from "../../../convex-dev/runtimeGatewayMediaQualifications";
import { lookupDeploymentManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { ensureBudget, installDeploymentPolicy, resolve } from "../../../convex-dev/runtimeModelPolicy";
import { canonicalModelJson, resolveModelPolicy } from "../../../src/domain/model-policy";
import type { ModelOperationKey, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";

const historical: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V15;
const current: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V16;
const now = 1791546000000;
const scope = { tenantId: "prompt-test", memorySpaceId: "prompt-test", principalId: "prompt-test", principalVersion: 1,
  membershipId: "prompt-test", membershipVersion: 1, grantId: "prompt-test", grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
function select(manifest: DeploymentPolicyManifest, operationKey: ModelOperationKey) {
  return resolveModelPolicy({ context: { scope, operationKey, runBudgetId: "prompt-test", authorizedOverrides: [] },
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
    const contentHash = await semanticHash("Owned extraction context");
    f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId,
      ownerPrincipalId: f.reference.principalId, lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1,
        role: "user", trust: "user_assertion" }, content: "Owned extraction context", contentHash, createdAt: Date.now() });
    return { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash };
  };
  return { ...f, installRevision, bindRequest, source, read };
}
function expectNoModelEffects(f: ReturnType<typeof fixture>) {
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
}

describe("immutable extraction prompt successor16", () => {
  it("keeps all historical manifests and proofs exact; changes only the extraction prompt and required successor policy identities", () => {
    for (const manifest of [DEFAULT_GATEWAY_POLICY_MANIFEST, AGENT_GATEWAY_POLICY_MANIFEST_V5, TEXT_GATEWAY_POLICY_MANIFEST_V3,
      OBSERVED_GATEWAY_POLICY_MANIFEST_V14, historical, current]) {
      expect(lookupDeploymentManifest(manifest.manifestId, manifest.revision)).toBe(manifest);
    }
    expect(current.qualifications).toBe(historical.qualifications); expect(current.dispatchEvidence).toBe(historical.dispatchEvidence);
    expect(current.budgetWindowMs).toBe(historical.budgetWindowMs);
    expect(current.policies).toHaveLength(historical.policies.length);
    current.policies.forEach((policy, i) => {
      const previous = historical.policies[i]!;
      expect(policy.policyId).toBe(previous.policyId.replace(/-v15$/, "-v16")); expect(policy.version).toBe(16);
      if (policy.operationKey === "memory.extract") {
        expect(select(historical, "memory.extract").pins.promptVersion).toBe("memory-schema-prompt-v2");
        expect(policy.rules).toEqual({ ...previous.rules, pins: { ...previous.rules.pins, promptVersion: "memory-extraction-instance-prompt-v3" } });
      } else expect(policy.rules).toBe(previous.rules);
    });
  });

  it("resolves extraction v3 under the same actual plain-chat proof; conflict and ordinary text semantic pins are unchanged", () => {
    const extract = select(current, "memory.extract"), old = select(historical, "memory.extract");
    expect(extract).toMatchObject({ qualificationReceiptId: "ACTUAL-memory-extract-20261009", nativeInterface: "chat",
      modelId: "openai/gpt-4o-mini", pins: { promptVersion: "memory-extraction-instance-prompt-v3", schemaVersion: "facts-v1" } });
    expect(extract.limits).toEqual(old.limits); expect(extract.costBound).toEqual(old.costBound);
    for (const key of ["facts.resolve", "memory.summarize", "artifact.text", "artifact.code", "artifact.sheet", "artifact.suggestions", "conversation.title"] as const) {
      const before = select(historical, key), after = select(current, key);
      expect(after.pins).toEqual(before.pins); expect(after.limits).toEqual(before.limits);
      expect(after.qualificationReceiptId).toBe(before.qualificationReceiptId);
    }
    expect(select(current, "facts.resolve").pins).toMatchObject({ promptVersion: "memory-schema-prompt-v2", schemaVersion: "conflicts-v1" });
    expect(() => select(current, "media.video.generate")).toThrow("CAPABILITY_UNAVAILABLE");
  });

  it("installs15→16 without changing old accounting/root/window/holds or allowing a tenant reset", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      await f.installRevision(15); await f.bindRequest("retained");
      f.db.table("runtimeBudgetAccounts").forEach(row => { row.uncertainUnits = 100000; row.activeConcurrency = 1; });
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
      await f.installRevision(16); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
      const writes = f.db.writes;
      await expect(f.bindRequest("cannot-reset")).rejects.toThrow("BUDGET_EXCEEDED");
      await f.installRevision(16);
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });

  it("resolves the registered v3 pin and reuses the same budget without model or reservation effects", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      await f.installRevision(16); const budget = await f.bindRequest("new-prompt"); const source = await f.source();
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
      const result = await f.read(f.ctx, { reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId, source });
      expect(result.snapshot.pins.promptVersion).toBe("memory-extraction-instance-prompt-v3");
      expect(result.dispatchEvidence).toBe(current.dispatchEvidence.find(proof => proof.receiptId === "ACTUAL-memory-extract-20261009"));
      expect(await f.bindRequest("new-prompt")).toEqual(budget);
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });

  it("still refuses selected-proof expiry before any new write, reservation or model effect", async () => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      await f.installRevision(16); const budget = await f.bindRequest("before-expiry"); const source = await f.source();
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
      time.mockReturnValue(current.dispatchEvidence.find(proof => proof.receiptId === "ACTUAL-memory-extract-20261009")!.expiresAt);
      await expect(f.read(f.ctx, { reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId, source })).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      await expect(f.bindRequest("expired")).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
});
