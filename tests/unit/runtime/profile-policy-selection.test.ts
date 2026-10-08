/** Controlled native ledger only; no provider dispatch, managed index or price qualification. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { RuntimeAuthorityReference } from "../../../src/auth/verified";
import type { ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE as small, LARGE_EMBEDDING_PROFILE as large } from "../../../src/domain/profile";
const { installIngestionMockRoot, currentMockRootSelection, transcriptFixture, ledger } = await import("../runtimeTranscript/fixture");
const bootstrap = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
const largePins = { priceRevision: "offline-large-price-v1", boundRevision: "offline-large-bound-v1" };

beforeEach(() => {
  installIngestionMockRoot({ large: true });
  const selection = currentMockRootSelection();
  const root = bootstrap.lookupDeploymentManifest(selection.manifestId, selection.expectedRevision)!;
  // Only newly constructed synthetic records change, before installation. The
  // original default qualification/proof objects retain their exact bytes.
  const qualification = root.qualifications.find(item => item.modelId === large.modelId)!;
  Object.assign(qualification, largePins);
  Object.assign(root.dispatchEvidence.find(item => item.receiptId === qualification.receiptId)!, largePins);
  const old = root.qualifications.find(item => item.modelId === small.modelId)!;
  for (const policy of root.policies.filter(item => item.operationKey?.startsWith("embedding."))) {
    Object.assign(policy.rules, { modelId: small.modelId, pins: { ...policy.rules.pins, priceRevision: old.priceRevision, boundRevision: old.boundRevision } });
  }
});
afterEach(() => { jest.restoreAllMocks(); });

async function fixture() {
  const f = await transcriptFixture({ maxContextTokens: 16384 });
  const grant = f.db.seed("runtimeAuthGrants", { principalId: f.reference.principalId, membershipId: f.reference.membershipId,
    tenantId: f.reference.tenantId, tenantEpoch: f.reference.tenantEpoch, capabilities: ["admin"], resourceAccess: "tenant", version: 1 });
  const admin: RuntimeAuthorityReference = { principalId: f.reference.principalId, principalVersion: f.reference.principalVersion,
    membershipId: f.reference.membershipId, membershipVersion: f.reference.membershipVersion, grantId: grant._id,
    grantVersion: 1, tenantId: f.reference.tenantId, tenantEpoch: f.reference.tenantEpoch };
  const policy = (operationKey = "embedding.query", changes: Record<string, unknown> = {}) => ({ policyId: `selected-${operationKey}`, version: 1,
    scope: "tenant", tenantId: f.reference.tenantId, operationKey,
    rules: { modelId: large.modelId, nativeInterface: "embedding", pins: largePins, ...changes } });
  return { ...f, admin, grant, policy };
}

describe("exact compiled embedding qualification selectors", () => {
  it.each(["embedding.memory", "embedding.query"])("tenant admin selects %s from the same trusted root without touching money", async operationKey => {
    const f = await fixture();
    const binding = await f.call<{ runBudgetId: string }>(ledger.ensureBudget, { reference: f.reference, operationKey: "embedding.query",
      requestId: "small-before-selection", requestCanonical: canonicalModelJson({ text: "fixture" }) });
    const before = JSON.stringify(f.db.table("runtimeBudgetAccounts"));
    await f.call(ledger.provisionTenantPolicy, { reference: f.admin, policyCanonical: canonicalModelJson(f.policy(operationKey)) });
    expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(before);
    expect(await f.call(ledger.embeddingProfile, { reference: f.reference, operationKey, runBudgetId: binding.runBudgetId })).toEqual(large);
    expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it("a small unknown-charge operation survives selection while a fresh large budget shares the same tenant account", async () => {
    const f = await fixture();
    const binding = await f.call<{ runBudgetId: string }>(ledger.ensureBudget, { reference: f.reference, operationKey: "embedding.query",
      requestId: "small-liability", requestCanonical: canonicalModelJson({ text: "fixture" }) });
    const resolved = await f.call<{ snapshot: ModelPolicySnapshotV1 }>(ledger.resolve, { reference: f.reference, operationKey: "embedding.query", runBudgetId: binding.runBudgetId });
    const requestCanonical = canonicalModelJson({ semanticId: "small-uncertain", childCallId: "controlled-child", texts: ["fixture"], inputTokens: 1, outputTokens: 0,
      toolSteps: 0, timeoutMs: 1000, reservationUnits: 1, promptVersion: resolved.snapshot.pins.promptVersion,
      schemaVersion: resolved.snapshot.pins.schemaVersion, extractionVersion: resolved.snapshot.pins.extractionVersion,
      toolRegistryVersion: resolved.snapshot.pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 }, profile: small,
      batch: { ordinal: 0, start: 0, end: 1 } });
    const admitted = await f.call<{ attemptId: string; requestCanonical: string }>(ledger.admit, { reference: f.reference, operationKey: "embedding.query",
      runBudgetId: binding.runBudgetId, semanticId: "small-uncertain", ordinal: 0, requestCanonical });
    await f.call(ledger.checkpoint, { reference: f.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical });
    await f.call(ledger.recover, { reference: f.reference, attemptId: admitted.attemptId });
    const tenant = f.db.table("runtimeBudgetAccounts").find(row => row.kind === "tenant")!;
    const oldMoney = JSON.stringify(tenant); const oldAttempts = JSON.stringify(f.db.table("runtimeModelAttempts"));
    // No terminal was observed in this controlled unknown outcome, so the
    // existing slot stays occupied as well as the full monetary liability.
    expect(tenant).toMatchObject({ uncertainUnits: 100000, reservedUnits: 0, activeConcurrency: 1 });
    await f.call(ledger.provisionTenantPolicy, { reference: f.admin, policyCanonical: canonicalModelJson(f.policy()) });
    const next = await f.call<{ runBudgetId: string }>(ledger.ensureBudget, { reference: f.reference, operationKey: "embedding.query",
      requestId: "large-new-request", requestCanonical: canonicalModelJson({ text: "fixture" }) });
    expect(JSON.stringify(f.db.table("runtimeBudgetAccounts").find(row => row.kind === "tenant"))).toBe(oldMoney);
    expect(JSON.stringify(f.db.table("runtimeModelAttempts"))).toBe(oldAttempts);
    expect(await f.call(ledger.embeddingProfile, { reference: f.reference, operationKey: "embedding.query", runBudgetId: next.runBudgetId })).toEqual(large);
    expect(f.db.table("runtimeBudgetAccounts").filter(row => row.kind === "tenant")).toHaveLength(1);
  });
  it.each([
    { name: "unqualified price", operation: "embedding.query", rules: { pins: { ...largePins, priceRevision: "caller-price" } } },
    { name: "cross-model bound", operation: "embedding.query", rules: { modelId: small.modelId } },
    { name: "non-embedding operation", operation: "agent.respond", rules: {} },
    { name: "wrong interface", operation: "embedding.query", rules: { nativeInterface: "chat" } },
    { name: "prompt attestation", operation: "embedding.query", rules: { pins: { ...largePins, promptVersion: "caller-prompt" } } },
    { name: "partial tuple", operation: "embedding.query", rules: { pins: { priceRevision: largePins.priceRevision } } },
  ])("rejects $name before policy/money writes", async ({ operation, rules }) => {
    const f = await fixture(); const before = f.db.writes;
    await expect(f.call(ledger.provisionTenantPolicy, { reference: f.admin, policyCanonical: canonicalModelJson(f.policy(operation, rules)) })).rejects.toThrow("POLICY_DENIED");
    expect(f.db.writes).toBe(before); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it("own-space admin cannot select tenant-wide proof pins", async () => {
    const f = await fixture(); const before = f.db.writes;
    await expect(f.call(ledger.provisionTenantPolicy, { reference: f.reference, policyCanonical: canonicalModelJson(f.policy()) })).rejects.toThrow("FORBIDDEN");
    expect(f.db.writes).toBe(before);
  });
});
