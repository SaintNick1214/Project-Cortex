/** Genuine compiled data, real native ledger handlers, controlled DB/terminal ports.
 * These outcomes are offline regressions; the retained K6 receipts establish actual qualification. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ModelCallRequest, ModelOperationKey, ModelPolicySnapshotV1 } from "../../../src/domain/model-policy";
import { canonicalModelJson, MEMORY_JSON_OBJECT_CONTRACT as contract, resolveModelPolicy } from "../../../src/domain/model-policy";
import { semanticHash } from "../../../src/domain/profile";
import { FACTS_JSON_SCHEMA } from "../../../src/domain/extraction";
import { parseSourceFactsResponse } from "../../../src/domain/sources";
import type { SourceContent } from "../../../src/domain/contracts";
import { AGENT_NATIVE_TOOLS_V2 } from "../../../src/domain/agent-tools";
import { buildSourceExtractionFramingV4 } from "../../../convex-dev/runtimeMemoryGateway";
import { OBSERVED_GATEWAY_POLICY_MANIFEST_V17 as historical, OBSERVED_GATEWAY_POLICY_MANIFEST_V18 as current } from "../../../convex-dev/runtimeGatewayMediaQualifications";
import { lookupDeploymentManifest, isTrustedDeploymentManifest } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import * as ledger from "../../../convex-dev/runtimeModelPolicy";
import { memoryFixture, registeredHandler } from "../runtimeMemory/fixture";

const now = 1791880000000;
const prefix = "ACTUAL-719bc7dc-a1ab-4223-8ffe-3c3f51e5c55b-";
const proof = current.dispatchEvidence.find(row => row.receiptId === prefix + "6")!;
beforeEach(() => { jest.spyOn(Date, "now").mockReturnValue(now); });
afterEach(() => { jest.restoreAllMocks(); });
async function fixture() {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run"];
  const invoke = async <T = unknown>(name: keyof typeof ledger, args: unknown) =>
    await f.db.transaction(async () => await registeredHandler<unknown, T>(ledger[name])(f.ctx, args));
  const install = (revision = 18) => invoke("installDeploymentPolicy", { manifestId: current.manifestId, expectedRevision: revision });
  const bind = <T = { runBudgetId: string; runAccountId: string }>(requestId: string) => invoke<T>("ensureBudget", {
    reference: f.reference, operationKey: "memory.extract", requestId, requestCanonical: canonicalModelJson({ stage: "extract", sourceId: "v18-source" }),
  });
  const source: SourceContent = { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId!, ownerPrincipalId: f.reference.principalId,
    lineage: { sourceId: "v18-source", sourceEventId: "v18-event", sourceRevision: 1, role: "user", trust: "user_assertion" },
    content: "Controlled explicit source evidence.", contentHash: await semanticHash("Controlled explicit source evidence."), createdAt: now };
  f.db.seed("runtimeMemorySources", source as unknown as Record<string, unknown>);
  const binding = { sourceId: source.lineage.sourceId, sourceEventId: source.lineage.sourceEventId, sourceRevision: source.lineage.sourceRevision, contentHash: source.contentHash };
  const read = (runBudgetId: string) => invoke<{ snapshot: ModelPolicySnapshotV1; dispatchEvidence: QualifiedDispatchEvidence }>("resolve", {
    reference: f.reference, operationKey: "memory.extract", runBudgetId, source: binding,
  });
  const extraction = async () => {
    await install(); const budget = await bind("v18-extract"), resolution = await read(budget.runBudgetId), framing = buildSourceExtractionFramingV4(source);
    const request: ModelCallRequest = { semanticId: "controlled-v18-extraction", childCallId: "controlled-v18-child", texts: [framing.system, framing.prompt],
      messages: [{ role: "system", parts: [{ type: "text", text: framing.system }] }, { role: "user", parts: [{ type: "text", text: framing.prompt }] }],
      inputTokens: 1, outputTokens: 512, toolSteps: 0, timeoutMs: 1000, reservationUnits: 1,
      promptVersion: resolution.snapshot.pins.promptVersion, schemaVersion: resolution.snapshot.pins.schemaVersion,
      extractionVersion: resolution.snapshot.pins.extractionVersion, toolRegistryVersion: resolution.snapshot.pins.toolRegistryVersion,
      outputSchema: FACTS_JSON_SCHEMA, responseFormat: { type: "json" }, tools: [], options: { maxRetries: 0 } };
    const admit = () => invoke<{ status: string; operationId: string; attemptId: string; requestCanonical: string }>("admit", {
      reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId, semanticId: request.semanticId,
      ordinal: 0, source: binding, requestCanonical: canonicalModelJson(request),
    });
    return { budget, resolution, request, admit };
  };
  return { ...f, invoke, install, bind, source, binding, read, extraction };
}

describe("genuine K6 successor V18 native registration", () => {
  it("keeps all historical proof objects and finite observed provenance, with unique successor policy rows", () => {
    expect(lookupDeploymentManifest(historical.manifestId, 17)).toBe(historical);
    expect(lookupDeploymentManifest(current.manifestId, 18)).toBe(current);
    expect(lookupDeploymentManifest(current.manifestId, 20)).toBeUndefined();
    expect(isTrustedDeploymentManifest(current)).toBe(true); expect(isTrustedDeploymentManifest({ ...current })).toBe(false);
    historical.qualifications.forEach((row, index) => expect(current.qualifications[index]).toBe(row));
    historical.dispatchEvidence.forEach((row, index) => expect(current.dispatchEvidence[index]).toBe(row));
    expect(current.qualifications.slice(historical.qualifications.length)).toHaveLength(7);
    expect(current.dispatchEvidence.slice(historical.dispatchEvidence.length)).toHaveLength(7);
    expect(current.policies.every(row => row.version === 18 && !historical.policies.some(old => old.policyId === row.policyId))).toBe(true);
    const observed = current.dispatchEvidence.slice(historical.dispatchEvidence.length);
    expect(observed.every(row => row.terminalCost === "unavailable" && row.expiresAt === 1792484091111)).toBe(true);
    expect(observed.map(row => row.checkedAt)).toEqual([1791879332795, 1791879335661, 1791879338395, 1791879341416, 1791879344474, 1791879363884, 1791879328790]);
  });
  it("installs the actual default root and resolves closed JSON extraction with no funding/model effects", async () => {
    const f = await fixture(); await f.install(); const budget = await f.bind("read-only-resolution");
    const money = canonicalModelJson(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
    const result = await f.read(budget.runBudgetId);
    expect(result.snapshot).toMatchObject({ qualificationReceiptId: prefix + "6", modelId: contract.modelId, nativeInterface: "chat",
      pins: { promptVersion: contract.promptVersion, schemaVersion: "facts-v1", toolRegistryVersion: "none-v1", boundRevision: contract.boundRevision },
      limits: { inputTokens: 8192, contextTokens: 16384, outputTokens: 512, toolSteps: 0, timeoutMs: 60000, operationBudgetUnits: 200000,
        runBudgetUnits: 3000000, tenantBudgetUnits: 10000000, concurrency: 2 }, allowedTools: [], allowedOptions: [], fallbackCandidates: [],
      costBound: { maximumCostUnits: 100000, coversAllProviderCharges: true } });
    expect(result.dispatchEvidence).toBe(proof); expect(result.dispatchEvidence.inputBound).toMatchObject({ ruleId: contract.inputRule, featureEnvelope: contract.featureEnvelope });
    expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(money);
    expect(f.db.table("runtimeModelOperations")).toEqual([]); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
  });
  it("keeps distinct observed selectors for plain facts/title, tools, embeddings and requested-only image, without video", () => {
    const select = (operationKey: ModelOperationKey) => resolveModelPolicy({ context: { scope: memoryFixture().reference, operationKey, runBudgetId: "v18-selectors", authorizedOverrides: [] },
      policies: current.policies.filter(row => !("operationKey" in row) || row.operationKey === operationKey), qualifications: current.qualifications });
    expect(select("facts.resolve")).toMatchObject({ qualificationReceiptId: prefix + "0", pins: { schemaVersion: "conflicts-v1", promptVersion: "memory-schema-prompt-v2" } });
    expect(select("conversation.title")).toMatchObject({ qualificationReceiptId: prefix + "1", modelId: "openai/gpt-4o" });
    const agent = select("agent.respond"); expect(agent.qualificationReceiptId).toBe(prefix + "4"); expect(agent.allowedTools).toEqual(AGENT_NATIVE_TOOLS_V2.map(tool => tool.name));
    expect(current.dispatchEvidence.find(row => row.receiptId === agent.qualificationReceiptId)).toMatchObject({ supportsStream: true, toolContract: { maximumToolCalls: 1 } });
    for (const operation of ["embedding.memory", "embedding.query"] as const) expect(select(operation)).toMatchObject({ qualificationReceiptId: prefix + "2", semanticProfile: { dimensions: 1536 } });
    expect(select("media.image.generate")).toMatchObject({ qualificationReceiptId: prefix + "5", costBound: { maximumCostUnits: 2000000 } });
    expect(() => select("media.video.generate")).toThrow("CAPABILITY_UNAVAILABLE");
  });
  it("monotone install preserves old financial rows and cannot reset held UNKNOWN liability", async () => {
    const f = await fixture(); jest.spyOn(Date, "now").mockReturnValue(1791546000000);
    await f.install(17); await f.bind("historical-money");
    f.db.table("runtimeBudgetAccounts").forEach(row => { row.uncertainUnits = 100000; row.activeConcurrency = 1; });
    const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    jest.spyOn(Date, "now").mockReturnValue(now); await f.install();
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
    const writes = f.db.writes; await expect(f.bind("cannot-refund-old-root")).rejects.toThrow("BUDGET_EXCEEDED");
    await f.install(); expect(f.db.writes).toBe(writes); expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
    await expect(f.install(17)).rejects.toThrow("IDEMPOTENCY_CONFLICT"); expect(f.db.writes).toBe(writes);
  });
  it.each(["expired", "revoked", "source-changed"])("%s current evidence denies the native checkpoint while retaining the original reservation", async fault => {
    const f = await fixture(), { admit } = await f.extraction(), admitted = await admit();
    const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    if (fault === "expired") jest.spyOn(Date, "now").mockReturnValue(proof.expiresAt);
    if (fault === "revoked") f.grant.revokedAt = now;
    if (fault === "source-changed") f.db.table("runtimeMemorySources")[0].contentHash = "a".repeat(64);
    await expect(f.invoke("checkpoint", { reference: f.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical })).rejects.toThrow();
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before); expect(f.db.table("runtimeModelAttempts")[0].checkpointAt).toBeUndefined();
  });
  it.each(["missing-input", "missing-output", "over-input", "over-output", "valid"])("%s simulated terminal preserves complete usage guards, UNKNOWN accounting and replay", async usageCase => {
    const f = await fixture(), { admit } = await f.extraction(), admitted = await admit();
    await f.invoke("checkpoint", { reference: f.reference, attemptId: admitted.attemptId, requestCanonical: admitted.requestCanonical });
    const attempt = f.db.table("runtimeModelAttempts")[0];
    const usage: Record<string, number> = { inputTokens: 2, outputTokens: 2 };
    if (usageCase === "missing-input") delete usage.inputTokens;
    if (usageCase === "missing-output") delete usage.outputTokens;
    if (usageCase === "over-input") usage.inputTokens = (attempt.measuredInputTokens as number) + 1;
    if (usageCase === "over-output") usage.outputTokens = 513;
    const receiptCanonical = canonicalModelJson({ version: 1, dispatchIdentity: attempt.dispatchIdentity, receiptId: "controlled-v18-terminal",
      modelId: contract.modelId, nativeInterface: "chat", actualModel: contract.modelId, outcome: "confirmed", proof: "provider-terminal-v1", costSource: "unavailable", usage });
    const captured = await f.invoke<{ evidenceId: string }>("captureTerminalEvidence", { attemptId: admitted.attemptId, dispatchIdentity: attempt.dispatchIdentity, receiptCanonical });
    expect(await f.invoke("attachTerminalResult", { reference: f.reference, attemptId: admitted.attemptId, evidenceId: captured.evidenceId, privateResultCanonical: canonicalModelJson({ text: '{"facts":[]}' }) }))
      .toEqual(usageCase === "valid" ? { attached: true, resultWithheld: false } : { attached: false, resultWithheld: true });
    expect(f.db.table("runtimeBudgetAccounts").every(row => row.uncertainUnits === 100000 && row.reservedUnits === 0 && row.settledUnits === 0 && row.activeConcurrency === 0)).toBe(true);
    expect(await admit()).toMatchObject({ status: usageCase === "valid" ? "replay" : "uncertain" }); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
    if (usageCase === "valid") expect(parseSourceFactsResponse({ facts: [] }, f.source)).toEqual([]);
  });
});
