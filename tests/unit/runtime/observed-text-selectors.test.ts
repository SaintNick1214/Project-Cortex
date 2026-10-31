/** Offline controlled registered-handler checks; no provider or service calls. */
import { describe, expect, it, jest } from "@jest/globals";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V14, OBSERVED_GATEWAY_POLICY_MANIFEST_V15 } from "../../../convex-dev/runtimeGatewayMediaQualifications";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import { ensureBudget, installDeploymentPolicy, resolve } from "../../../convex-dev/runtimeModelPolicy";
import { canonicalModelJson, resolveModelPolicy } from "../../../src/domain/model-policy";
import type { ModelOperationKey, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import { CONTENT_INTENTS, contentOperation } from "../../../src/domain/content";
import { semanticHash } from "../../../src/domain/profile";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";

const historical: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V14;
const current: DeploymentPolicyManifest = OBSERVED_GATEWAY_POLICY_MANIFEST_V15;
const genericKeys = ["memory.summarize", "artifact.text", "artifact.code", "artifact.sheet", "artifact.suggestions"] as const;
const overrideKeys = ["agent.respond", "conversation.title", "memory.extract", "embedding.memory", "embedding.query", "media.image.generate"] as const;
const clock = 1791546612384; // Controlled currentness after the historical proof expiry.
const scope = { tenantId: "text-selector", memorySpaceId: "text-selector", principalId: "text-selector", principalVersion: 1,
  membershipId: "text-selector", membershipVersion: 1, grantId: "text-selector", grantVersion: 1, tenantEpoch: 1, memorySpaceEpoch: 1 };
function select(manifest: DeploymentPolicyManifest, operationKey: ModelOperationKey) {
  return resolveModelPolicy({ context: { scope, operationKey, runBudgetId: "text-selector", authorizedOverrides: [] },
    policies: manifest.policies.filter(policy => !policy.operationKey || policy.operationKey === operationKey), qualifications: manifest.qualifications });
}
function fixture() {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run"];
  const install = registeredHandler<{ manifestId: string; expectedRevision: number }, unknown>(installDeploymentPolicy);
  const bind = registeredHandler<{ reference: typeof f.reference; operationKey: ModelOperationKey; requestId: string; requestCanonical: string }, { runBudgetId: string }>(ensureBudget);
  type Source = { sourceId: string; sourceEventId: string; sourceRevision: number; contentHash: string };
  const read = registeredHandler<{ reference: typeof f.reference; operationKey: ModelOperationKey; runBudgetId: string; source?: Source },
    { snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence }>(resolve);
  const installRevision = (revision: number) => install(f.ctx, { manifestId: current.manifestId, expectedRevision: revision });
  const bindRequest = (operationKey: ModelOperationKey, requestId: string = operationKey) => bind(f.ctx, { reference: f.reference, operationKey, requestId,
    requestCanonical: canonicalModelJson({ text: "Owned ordinary operation" }) });
  const source = async () => {
    const contentHash = await semanticHash("Owned ordinary source");
    f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
      lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" },
      content: "Owned ordinary source", contentHash, createdAt: Date.now() });
    return { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash };
  };
  return { ...f, installRevision, bindRequest, source, read };
}
function expectNoModelEffects(f: ReturnType<typeof fixture>) {
  expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
}

describe("observed generic text selectors successor15", () => {
  it("covers every closed content intent and changes only default qualification selectors, retaining semantic pins and all limits", () => {
    expect(CONTENT_INTENTS.map(contentOperation)).toEqual(["conversation.title", "artifact.text", "artifact.code", "artifact.sheet", "artifact.suggestions"]);
    const previous = historical.policies.find(policy => !policy.operationKey)!, next = current.policies.find(policy => !policy.operationKey)!;
    expect(next.rules).toEqual({ ...previous.rules, pins: { ...previous.rules.pins,
      priceRevision: "gateway-2026-10-09-observed-default", boundRevision: "text-8192-512-schema-observed-20261009" } });
    expect(current.qualifications).toBe(historical.qualifications); expect(current.dispatchEvidence).toBe(historical.dispatchEvidence);
  });
  it.each(genericKeys)("resolves ordinary %s through current registered budget and resolver handlers using the same generic chat proof", async operationKey => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(clock);
    try {
      await f.installRevision(15); const budget = await f.bindRequest(operationKey);
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
      const result = await f.read(f.ctx, { reference: f.reference, operationKey, runBudgetId: budget.runBudgetId });
      expect(result.snapshot).toMatchObject({ operationKey, qualificationReceiptId: "ACTUAL-memory-extract-20261009", modelId: "openai/gpt-4o-mini",
        nativeInterface: "chat", limits: { inputTokens: 8192, contextTokens: 16384, outputTokens: 512, operationBudgetUnits: 200000 },
        costBound: { maximumCostUnits: 100000 } });
      expect(result.dispatchEvidence.inputBound).toMatchObject({ featureEnvelope: "plain-chat-v1", ruleId: "plain-chat-cookbook-utf8-v1" });
      const previous = select(historical, operationKey);
      for (const key of ["schemaVersion", "promptVersion", "extractionVersion", "toolRegistryVersion"] as const) expect(result.snapshot.pins[key]).toBe(previous.pins[key]);
      expect(await f.bindRequest(operationKey)).toEqual(budget);
      expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expect(f.db.writes).toBe(writes); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
  it.each(genericKeys)("preserves the historical expired %s refusal before budget or model writes", async operationKey => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(clock);
    try {
      await f.installRevision(14); const writes = f.db.writes;
      await expect(f.bindRequest(operationKey)).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeBudgetAccounts")).toEqual([]); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
  it.each(overrideKeys)("preserves the existing fresh %s override and resolves it through registered handlers", async operationKey => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(clock);
    try {
      await f.installRevision(15); const budget = await f.bindRequest(operationKey);
      const source = ["memory.extract", "embedding.memory"].includes(operationKey) ? await f.source() : undefined;
      const result = await f.read(f.ctx, { reference: f.reference, operationKey, runBudgetId: budget.runBudgetId, ...(source ? { source } : {}) });
      const previous = select(historical, operationKey);
      expect(result.snapshot.qualificationReceiptId).toBe(previous.qualificationReceiptId);
      expect(result.snapshot.modelId).toBe(previous.modelId); expect(result.snapshot.nativeInterface).toBe(previous.nativeInterface);
      expect(result.snapshot.pins).toEqual(previous.pins); expect(result.snapshot.limits).toEqual(previous.limits);
      expect(result.dispatchEvidence.checkedAt).toBeLessThanOrEqual(clock); expect(result.dispatchEvidence.expiresAt).toBeGreaterThan(clock); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
  it.each(genericKeys)("refuses selected fresh %s proof at its real expiry without financial mutation", async operationKey => {
    const f = fixture(), time = jest.spyOn(Date, "now").mockReturnValue(clock);
    try {
      await f.installRevision(15); const budget = await f.bindRequest(operationKey);
      const proof = current.dispatchEvidence.find(entry => entry.receiptId === "ACTUAL-memory-extract-20261009")!;
      const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
      time.mockReturnValue(proof.expiresAt);
      await expect(f.read(f.ctx, { reference: f.reference, operationKey, runBudgetId: budget.runBudgetId })).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      await expect(f.bindRequest(operationKey, `${operationKey}:expired`)).rejects.toThrow("CAPABILITY_UNAVAILABLE");
      expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expectNoModelEffects(f);
    } finally { time.mockRestore(); }
  });
});
