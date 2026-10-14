/** Offline native-handler fixtures. This fake database does NOT prove Convex OCC/isolation/rollback. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { Doc, Id } from "../../../convex-dev/_generated/dataModel";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { ModelCallRequest, TrustedModelPolicyRecord } from "../../../src/domain/model-policy";
import { canonicalModelJson, MEMORY_JSON_OBJECT_CONTRACT, memoryJsonObjectInputBound } from "../../../src/domain/model-policy";
import { FACTS_JSON_SCHEMA } from "../../../src/domain/extraction";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "../../../src/domain/profile";

const lookup = jest.fn<(id: string, revision: number) => DeploymentPolicyManifest | undefined>();
const trustedBootstrap = await import("../../../convex-dev/runtimeModelPolicyBootstrap");
jest.unstable_mockModule("../../../convex-dev/runtimeModelPolicyBootstrap", () => ({ qualifiedTerminalModelId: trustedBootstrap.qualifiedTerminalModelId, lookupDeploymentManifest: lookup, isTrustedDeploymentManifest: (entry: DeploymentPolicyManifest) => entry === root && entry.classification === "fixture-synthetic" }));
const ledger = await import("../../../convex-dev/runtimeModelPolicy");
const { memoryFixture } = await import("../runtimeMemory/fixture");
const definitions = await import("../../../convex-dev/agentDefinitions");
const schema = (await import("../../../convex-dev/schema")).default;
const hash = "a".repeat(64);
const clock = 1_000_000;
const limits = { inputTokens: 1000, contextTokens: 2000, outputTokens: 500, toolSteps: 4, timeoutMs: 10000,
  operationBudgetUnits: 200, runBudgetUnits: 300, tenantBudgetUnits: 500, concurrency: 2 };
const pins = { promptVersion: "prompt-1", schemaVersion: "schema-1", extractionVersion: "extract-1", toolRegistryVersion: "tools-1", priceRevision: "price-1", boundRevision: "bound-1" };
const deployment: TrustedModelPolicyRecord = { policyId: "deployment", version: 1, scope: "deployment", rules: {
  modelId: "openai/gpt-4o-mini", nativeInterface: "chat", allowedModels: ["openai/gpt-4o-mini", DEFAULT_EMBEDDING_PROFILE.modelId], interfaces: ["chat", "embedding"],
  capabilities: ["text", "embedding"], allowedOptions: ["temperature"], allowedTools: [], fallbackModels: [], limits, pins } };
/** Synthetic trust-root mock ONLY; no production manifest or actual price qualification is created. */
function manifest(): DeploymentPolicyManifest {
  const qualification = { receiptId: "synthetic-chat", modelId: "openai/gpt-4o-mini", nativeInterface: "chat" as const, capabilities: ["text" as const], allowedOptions: ["temperature" as const],
    limits, costBound: { kind: "qualified-call-ceiling" as const, maximumCostUnits: 100, provenance: "synthetic-test-only", coversAllProviderCharges: true as const }, priceRevision: "price-1", boundRevision: "bound-1" };
  const proof: QualifiedDispatchEvidence = { receiptId: qualification.receiptId, evidenceHash: hash, providerVersion: "synthetic-0", modelId: qualification.modelId, nativeInterface: "chat",
    inputBound: { ruleId: "plain-chat-cookbook-utf8-v1", revision: 1, featureEnvelope: "plain-chat-v1", nativeTransformHash: hash, documentHash: hash, proofHash: hash },
    resultBound: { maximumPrivateResultBytes: 60_000, maximumOutputTokens: 500, maximumEmbeddingValues: 1, proofHash: hash },
    checkedAt: clock - 1, expiresAt: clock + 1_000_000, terminalCost: "gateway-aggregate-usd-v1", terminalProof: "provider-terminal-v1", priceRevision: "price-1", boundRevision: "bound-1" };
  return { manifestId: "synthetic-test-root", revision: 1, artifactRevision: "synthetic-test-artifact", evidenceHash: hash, acceptanceHash: hash, classification: "fixture-synthetic",
    budgetWindowMs: 60_000, policies: [deployment], qualifications: [qualification], dispatchEvidence: [proof] };
}
type Bound = { runBudgetId: string; runAccountId: Id<"runtimeBudgetAccounts"> };
type Reserved = { status: "reserved"; operationId: Id<"runtimeModelOperations">; attemptId: Id<"runtimeModelAttempts">; requestCanonical: string };
type Registration = { _handler: (ctx: MutationCtx, args: unknown) => Promise<unknown>; isInternal?: boolean; isPublic?: boolean; exportArgs?: () => string };
function request(text = "hello"): ModelCallRequest {
  return { semanticId: "semantic", childCallId: "untrusted-estimate", texts: [text], messages: [{ role: "user", parts: [{ type: "text", text }] }],
    inputTokens: 1, outputTokens: 20, toolSteps: 0, timeoutMs: 1000, reservationUnits: 1, promptVersion: pins.promptVersion, schemaVersion: pins.schemaVersion, extractionVersion: pins.extractionVersion, toolRegistryVersion: pins.toolRegistryVersion, tools: [], options: { maxRetries: 0 } };
}
let root: DeploymentPolicyManifest;
beforeEach(() => {
  root = manifest(); lookup.mockReset(); lookup.mockImplementation((id, revision) => id === root.manifestId && revision === root.revision ? root : undefined);
  jest.spyOn(Date, "now").mockReturnValue(clock);
});
afterEach(() => { jest.restoreAllMocks(); });
function fixture() {
  const f = memoryFixture(); f.grant.capabilities = ["read", "write", "run", "admin"]; 
  const db = Object.assign(f.db, { patch: async (table: string, id: string, updates: Record<string, unknown>) => {
    const row = await f.db.get(table, id); if (!row) throw new Error("Missing patch row"); f.db.writes++; Object.assign(row, JSON.parse(JSON.stringify(updates)) as Record<string, unknown>);
  } });
  db.insert = async (table: string, value: Record<string, unknown>) => { db.writes++; return db.seed(table, JSON.parse(JSON.stringify(value)) as Record<string, unknown>)._id; };
  const invoke = async <Result = unknown>(name: keyof typeof ledger, args: unknown): Promise<Result> => {
    const registration = ledger[name] as unknown as Registration;
    return await registration._handler(f.ctx, args) as Result;
  };
  const install = async () => await invoke("installDeploymentPolicy", { manifestId: root.manifestId, expectedRevision: root.revision });
  const bind = async (id = "request", identity = canonicalModelJson({ text: "hello" })) => await invoke<Bound>("ensureBudget", {
    reference: f.reference, operationKey: "agent.respond", requestId: id, requestCanonical: identity,
  });
  const admit = async (binding: Bound, ordinal = 0, text = "hello", extra: Record<string, unknown> = {}) => await invoke<Reserved>("admit", {
    reference: f.reference, operationKey: "agent.respond", runBudgetId: binding.runBudgetId, semanticId: "semantic", ordinal,
    requestCanonical: canonicalModelJson(request(text)), ...extra,
  });
  const checkpoint = async (attempt: Reserved) => await invoke("checkpoint", { reference: f.reference, attemptId: attempt.attemptId, requestCanonical: attempt.requestCanonical });
  const account = (kind: string): Doc<"runtimeBudgetAccounts"> => db.table("runtimeBudgetAccounts").find((row) => row.kind === kind) as unknown as Doc<"runtimeBudgetAccounts">;
  const attempt = (id: string): Doc<"runtimeModelAttempts"> => db.table("runtimeModelAttempts").find((row) => row._id === id) as unknown as Doc<"runtimeModelAttempts">;
  const receipt = (submission: Reserved, cost = "0.000040", extra: Record<string, unknown> = {}) => canonicalModelJson({ version: 1,
    dispatchIdentity: attempt(submission.attemptId).dispatchIdentity, receiptId: "terminal-1", modelId: "openai/gpt-4o-mini", nativeInterface: "chat",
    outcome: "confirmed", proof: "provider-terminal-v1", costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: cost,
    privateResultCanonical: canonicalModelJson({ text: "answer" }), ...extra });
  const settle = async (submission: Reserved, cost = "0.000040", extra: Record<string, unknown> = {}) => await invoke("settle", { reference: f.reference,
    attemptId: submission.attemptId, receiptCanonical: receipt(submission, cost, extra) });
  return { ...f, db, invoke, install, bind, admit, checkpoint, account, attempt, receipt, settle };
}
async function admitted() { const f = fixture(); await f.install(); const b = await f.bind(); const a = await f.admit(b); return { f, b, a }; }
async function jsonLedger(terminalCost: "unavailable" | "gateway-aggregate-usd-v1" = "unavailable") {
  const f = fixture(), c = MEMORY_JSON_OBJECT_CONTRACT;
  const jsonLimits = { ...limits, inputTokens: 8192, contextTokens: 16384, outputTokens: 512, toolSteps: 0,
    operationBudgetUnits: 100000, runBudgetUnits: 3000000, tenantBudgetUnits: 10000000 };
  const q = { ...root.qualifications[0]!, receiptId: "synthetic-json-not-actual", capabilities: ["structured" as const], allowedOptions: [],
    limits: jsonLimits, boundRevision: c.boundRevision, costBound: { ...root.qualifications[0]!.costBound, maximumCostUnits: 100000 } };
  const proof = { ...root.dispatchEvidence[0]!, receiptId: q.receiptId, boundRevision: c.boundRevision, terminalCost,
    inputBound: { ...root.dispatchEvidence[0]!.inputBound, featureEnvelope: c.featureEnvelope, ruleId: c.inputRule },
    resultBound: { ...root.dispatchEvidence[0]!.resultBound, maximumOutputTokens: 512 } };
  root = { ...root, policies: [{ ...deployment, rules: { ...deployment.rules, capabilities: ["text", "structured", "embedding"], limits: jsonLimits } },
    { policyId: "json-extraction", version: 1, scope: "deployment", operationKey: "memory.extract", rules: { allowedOptions: [], allowedTools: [],
      pins: { promptVersion: c.promptVersion, schemaVersion: c.schemaVersion, toolRegistryVersion: c.toolRegistryVersion, boundRevision: c.boundRevision } } }],
    qualifications: [...root.qualifications, q], dispatchEvidence: [...root.dispatchEvidence, proof] };
  await f.install();
  const content = 'Owned "\\日本語🧪 extraction evidence', contentHash = await semanticHash(content);
  f.db.seed("runtimeMemorySources", { tenantId: f.reference.tenantId, memorySpaceId: f.reference.memorySpaceId, ownerPrincipalId: f.reference.principalId,
    lineage: { sourceId: "json-source", sourceEventId: "json-event", sourceRevision: 1, role: "user", trust: "user_assertion" }, content, contentHash, createdAt: clock });
  const source = { sourceId: "json-source", sourceEventId: "json-event", sourceRevision: 1, contentHash };
  const budget = await f.invoke<Bound>("ensureBudget", { reference: f.reference, operationKey: "memory.extract", requestId: "json-request", requestCanonical: canonicalModelJson({ jsonSource: source }) });
  const r: ModelCallRequest = { ...request(), promptVersion: c.promptVersion, schemaVersion: c.schemaVersion, toolRegistryVersion: c.toolRegistryVersion,
    texts: ["Return JSON data.", content], messages: [{ role: "system", parts: [{ type: "text", text: "Return JSON data." }] }, { role: "user", parts: [{ type: "text", text: content }] }],
    outputTokens: 512, outputSchema: FACTS_JSON_SCHEMA, responseFormat: { type: "json" } };
  const args = { reference: f.reference, operationKey: "memory.extract", runBudgetId: budget.runBudgetId, semanticId: r.semanticId, ordinal: 0, source, requestCanonical: canonicalModelJson(r) };
  const admit = async (value = r) => await f.invoke<Reserved>("admit", { ...args, requestCanonical: canonicalModelJson(value) });
  return { f, r, args, admit, proof, budget };
}

describe("native JSON-object admission and financial guards (offline handlers)", () => {
  it.each(["capture", "legacy-settle"])("%s cannot deliver extraction merely because money is known without complete usage", async route => {
    const { f, args, admit } = await jsonLedger("gateway-aggregate-usd-v1"), a = await admit(); await f.checkpoint(a);
    const charge = { version: 1, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptId: "known-cost-incomplete-usage",
      modelId: MEMORY_JSON_OBJECT_CONTRACT.modelId, nativeInterface: "chat", actualModel: MEMORY_JSON_OBJECT_CONTRACT.modelId,
      outcome: "confirmed", proof: "provider-terminal-v1", costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000040", usage: { inputTokens: 2 } };
    const privateResultCanonical = canonicalModelJson({ text: '{"facts":[]}' });
    if (route === "capture") {
      const capture = await f.invoke<{ evidenceId: string }>("captureTerminalEvidence", { attemptId: a.attemptId, dispatchIdentity: charge.dispatchIdentity, receiptCanonical: canonicalModelJson(charge) });
      expect(await f.invoke("attachTerminalResult", { reference: args.reference, attemptId: a.attemptId, evidenceId: capture.evidenceId, privateResultCanonical }))
        .toEqual({ attached: false, resultWithheld: true });
    } else {
      expect(await f.invoke("settle", { reference: args.reference, attemptId: a.attemptId, receiptCanonical: canonicalModelJson({ ...charge, privateResultCanonical }) }))
        .toMatchObject({ state: "settled", resultWithheld: true });
    }
    expect(f.account("run")).toMatchObject({ settledUnits: 40, activeConcurrency: 0 });
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    await expect(admit()).rejects.toThrow("CAPABILITY_UNAVAILABLE"); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  it("independently derives the whole-body count, preserves format at permit, and selects a separate receipt", async () => {
    const { f, r, args, admit } = await jsonLedger(); const a = await admit();
    const request = JSON.parse(a.requestCanonical) as ModelCallRequest;
    expect(request.inputTokens).toBe(memoryJsonObjectInputBound(request.messages, request.outputTokens)); expect(request.inputTokens).not.toBe(r.inputTokens);
    expect(f.attempt(a.attemptId).measuredInputTokens).toBe(request.inputTokens);
    expect(f.attempt(a.attemptId).snapshotCanonical).toContain("synthetic-json-not-actual");
    expect(await f.checkpoint(a)).toMatchObject({ dispatchPermit: true, requestCanonical: a.requestCanonical });
    expect(f.account("run")).toMatchObject({ reservedUnits: 100000, activeConcurrency: 1, limitUnits: 3000000 });
    const changed = { ...request }; delete changed.responseFormat;
    await expect(f.invoke("checkpoint", { reference: args.reference, attemptId: a.attemptId, requestCanonical: canonicalModelJson(changed) })).rejects.toThrow();
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  it.each(["absent", "schema", "wrong-schema", "bound", "role", "source", "revoked"])("denies %s before reservation", async kind => {
    const { f, r, args, admit } = await jsonLedger(), before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    if (kind === "absent") delete r.responseFormat;
    if (kind === "schema") (r as unknown as { responseFormat: unknown }).responseFormat = { type: "json", schema: FACTS_JSON_SCHEMA };
    if (kind === "wrong-schema") r.outputSchema = { type: "object" };
    if (kind === "bound") { r.texts[1] = "x".repeat(8192); r.messages![1]!.parts = [{ type: "text", text: r.texts[1] }]; }
    if (kind === "role") r.messages![1]!.role = "assistant";
    if (kind === "source") args.source.contentHash = "b".repeat(64);
    if (kind === "revoked") f.grant.revokedAt = clock;
    await expect(admit()).rejects.toThrow(); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
  });
  it.each(["expired", "revoked", "source-changed"])("%s qualification/authority/source at permit preserves original liability without dispatch", async kind => {
    const { f, admit, proof } = await jsonLedger(), a = await admit();
    const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    if (kind === "expired") jest.spyOn(Date, "now").mockReturnValue(proof.expiresAt);
    if (kind === "revoked") f.grant.revokedAt = clock;
    if (kind === "source-changed") f.db.table("runtimeMemorySources")[0]!.contentHash = "c".repeat(64);
    await expect(f.checkpoint(a)).rejects.toThrow();
    expect(f.attempt(a.attemptId).checkpointAt).toBeUndefined();
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
  });
  it("does not treat domain tenant priority as an authorized extraction pin switch", async () => {
    const { f } = await jsonLedger(); const reference = { ...f.reference }; delete reference.memorySpaceId;
    f.grant.resourceAccess = "tenant";
    await expect(f.invoke("provisionTenantPolicy", { reference, policyCanonical: canonicalModelJson({ policyId: "caller-json-pin", version: 1,
      scope: "tenant", tenantId: reference.tenantId, operationKey: "memory.extract", rules: { pins: { promptVersion: MEMORY_JSON_OBJECT_CONTRACT.promptVersion,
        boundRevision: MEMORY_JSON_OBJECT_CONTRACT.boundRevision } } }) })).rejects.toThrow();
    expect(f.db.table("runtimeModelPolicies").every(row => row.scope === "deployment")).toBe(true);
  });
  it.each(["missing-input", "missing-output", "over-input", "over-output", "valid"])("%s terminal conserves UNKNOWN, slots and replay disposition", async kind => {
    const { f, r, args, admit } = await jsonLedger(), a = await admit(); await f.checkpoint(a);
    const usage: Record<string, number> = { inputTokens: 2, outputTokens: 2 };
    if (kind === "missing-input") delete usage.inputTokens;
    if (kind === "missing-output") delete usage.outputTokens;
    if (kind === "over-input") usage.inputTokens = 8193;
    if (kind === "over-output") usage.outputTokens = 513;
    const receiptCanonical = canonicalModelJson({ version: 1, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptId: "json-terminal",
      modelId: MEMORY_JSON_OBJECT_CONTRACT.modelId, nativeInterface: "chat", actualModel: MEMORY_JSON_OBJECT_CONTRACT.modelId,
      outcome: "confirmed", proof: "provider-terminal-v1", costSource: "unavailable", usage });
    const captured = await f.invoke<{ evidenceId: string }>("captureTerminalEvidence", { attemptId: a.attemptId, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical });
    const resultCanonical = canonicalModelJson({ text: '{"facts":[]}' });
    expect(await f.invoke("attachTerminalResult", { reference: args.reference, attemptId: a.attemptId, evidenceId: captured.evidenceId, privateResultCanonical: resultCanonical }))
      .toEqual(kind === "valid" ? { attached: true, resultWithheld: false } : { attached: false, resultWithheld: true });
    expect(f.account("run")).toMatchObject({ uncertainUnits: 100000, settledUnits: 0, reservedUnits: 0, activeConcurrency: 0 });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100000, settledUnits: 0, reservedUnits: 0, activeConcurrency: 0 });
    const counts = [f.db.table("runtimeModelOperations").length, f.db.table("runtimeModelAttempts").length];
    expect(await admit(r)).toMatchObject({ status: kind === "valid" ? "replay" : "uncertain" });
    if (kind.startsWith("over-")) {
      expect(f.account("run").overrun).toBe(true);
      await expect(f.invoke("admit", { ...args, ordinal: 1 })).rejects.toThrow();
    }
    expect([f.db.table("runtimeModelOperations").length, f.db.table("runtimeModelAttempts").length]).toEqual(counts);
    expect(f.db.table("facts")).toEqual([]); expect(f.db.table("runtimeMemoryVectors")).toEqual([]);
  });
});

describe("native private policy ledger — offline logic only", () => {
  it("only compiled roots are reachable, and arbitrary operator manifest selectors cannot attest prices", async () => {
    expect(trustedBootstrap.lookupDeploymentManifest("caller-provided-policy", 1)).toBeUndefined();
    const f = fixture(); lookup.mockReturnValue(undefined);
    await expect(f.install()).rejects.toThrow(); expect(f.db.writes).toBe(0);
    await expect(f.bind()).rejects.toThrow(); expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(0);
  });
  it("installs the exact compiled root idempotently and refuses mutated same-version evidence", async () => {
    const f = fixture(); await f.install(); const writes = f.db.writes; await f.install(); expect(f.db.writes).toBe(writes);
    expect(f.db.table("runtimeModelPolicies")).toHaveLength(1); expect(f.db.table("runtimeModelQualifications")).toHaveLength(1);
    root = { ...root, artifactRevision: "changed" }; await expect(f.install()).rejects.toThrow();
  });
  it("retains expired unused evidence while the fresh selected proof installs, binds and reserves under the same root", async () => {
    const unused = { ...root.qualifications[0]!, receiptId: "historical-unused", modelId: "fixture/unused" };
    root = { ...root, qualifications: [...root.qualifications, unused], dispatchEvidence: [...root.dispatchEvidence,
      { ...root.dispatchEvidence[0]!, receiptId: unused.receiptId, modelId: unused.modelId, checkedAt: clock - 10_000, expiresAt: clock - 1 }] };
    const f = fixture(); await f.install(); const b = await f.bind(); const before = JSON.parse(JSON.stringify(f.account("tenant")));
    const a = await f.admit(b); expect(await f.checkpoint(a)).toMatchObject({ dispatchPermit: true });
    expect(f.db.table("runtimeModelQualifications")).toHaveLength(2);
    expect(f.account("tenant")).toMatchObject({ _id: before._id, root: before.root, windowId: before.windowId,
      reservedUnits: 100, settledUnits: 0, uncertainUnits: 0, activeConcurrency: 1 });
  });
  it("selected expiry denies new and existing budget binding, admission and dispatch with unchanged financial rows", async () => {
    root = { ...root, dispatchEvidence: root.dispatchEvidence.map(proof => ({ ...proof, expiresAt: clock + 10 })) };
    const { f, b, a } = await admitted(); const before = canonicalModelJson([f.db.table("runtimeBudgetAccounts"), f.db.table("runtimeModelOperations"), f.db.table("runtimeModelAttempts")]);
    const writes = f.db.writes; jest.spyOn(Date, "now").mockReturnValue(clock + 10);
    await expect(f.bind("another-request")).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    await expect(f.bind()).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    await expect(f.admit(b)).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    await expect(f.checkpoint(a)).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    expect(f.db.writes).toBe(writes);
    expect(canonicalModelJson([f.db.table("runtimeBudgetAccounts"), f.db.table("runtimeModelOperations"), f.db.table("runtimeModelAttempts")])).toBe(before);
  });
  it("selected expiry withholds settled replay without changing charge, window, root or released slot", async () => {
    root = { ...root, dispatchEvidence: root.dispatchEvidence.map(proof => ({ ...proof, expiresAt: clock + 10 })) };
    const { f, b, a } = await admitted(); await f.checkpoint(a); await f.settle(a);
    expect(await f.admit(b)).toMatchObject({ status: "replay" });
    const before = canonicalModelJson([f.db.table("runtimeBudgetAccounts"), f.db.table("runtimeModelOperations"), f.db.table("runtimeModelAttempts")]); const writes = f.db.writes;
    jest.spyOn(Date, "now").mockReturnValue(clock + 10);
    await expect(f.admit(b)).rejects.toThrow("CAPABILITY_UNAVAILABLE");
    expect(f.db.writes).toBe(writes);
    expect(canonicalModelJson([f.db.table("runtimeBudgetAccounts"), f.db.table("runtimeModelOperations"), f.db.table("runtimeModelAttempts")])).toBe(before);
  });
  it.each(["classification", "acceptance", "expiry", "model", "proof"])("rejects an invalid root %s before accounts/dispatch", async (field) => {
    if (field === "classification") root = { ...root, classification: "reviewed-actual" };
    if (field === "acceptance") root = { ...root, acceptanceHash: "claim" };
    if (field === "expiry") root = { ...root, dispatchEvidence: root.dispatchEvidence.map((proof) => ({ ...proof, expiresAt: clock - 2 })) };
    if (field === "model") root = { ...root, dispatchEvidence: root.dispatchEvidence.map((proof) => ({ ...proof, modelId: "foreign/model" })) };
    if (field === "proof") root = { ...root, dispatchEvidence: root.dispatchEvidence.map((proof) => ({ ...proof, inputBound: { ...proof.inputBound, proofHash: "claim" } })) };
    const f = fixture(); await expect(f.install()).rejects.toThrow(); expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(0);
  });
  it("binds one backend account per exact trusted request and rejects changed request/owner", async () => {
    const f = fixture(); await f.install(); const a = await f.bind(); expect(await f.bind()).toEqual(a);
    expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(2);
    await expect(f.bind("request", canonicalModelJson({ text: "changed" }))).rejects.toThrow();
    await expect(f.invoke("resolve", { reference: { ...f.reference, principalVersion: 2 }, operationKey: "agent.respond", runBudgetId: a.runBudgetId })).rejects.toThrow();
  });
  it("forced account-key hash collisions compare the complete trusted binding tuple", async () => {
    const f = fixture(); await f.install(); const b = await f.bind(); const before = f.db.writes;
    const collision = Uint8Array.from(Buffer.from(b.runBudgetId, "hex")).buffer;
    jest.spyOn(globalThis.crypto.subtle, "digest").mockResolvedValue(collision);
    await expect(f.bind("different-request-id")).rejects.toThrow();
    await expect(f.invoke("ensureBudget", { reference: f.reference, operationKey: "conversation.title", requestId: "request", requestCanonical: canonicalModelJson({ text: "hello" }) })).rejects.toThrow();
    expect(f.db.writes).toBe(before); expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(2);
  });
  it("derives actual normalized input and full trusted ceiling, overriding untrusted estimates", async () => {
    const { f, a } = await admitted(); const dispatched: unknown = JSON.parse(a.requestCanonical);
    expect(dispatched).toMatchObject({ inputTokens: 15, reservationUnits: 100 });
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 100, settledUnits: 0, uncertainUnits: 0, activeConcurrency: 1 });
    expect(f.account("run")).toMatchObject({ reservedUnits: 100, activeConcurrency: 1 });
  });
  it("same child canonical replay does not reserve again; changed text/hash collision rejects", async () => {
    const { f, b, a } = await admitted(); const before = f.db.writes;
    expect(await f.admit(b)).toMatchObject({ status: "inflight", attemptId: a.attemptId }); expect(f.db.writes).toBe(before);
    await expect(f.admit(b, 0, "changed")).rejects.toThrow(); expect(f.account("tenant").reservedUnits).toBe(100);
    f.attempt(a.attemptId).canonical = canonicalModelJson({ forcedCollision: true });
    await expect(f.admit(b)).rejects.toThrow(); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  it("one checkpoint winner returns a permit and subsequent attempts cannot dispatch", async () => {
    const { f, a } = await admitted(); expect(await f.checkpoint(a)).toMatchObject({ dispatchPermit: true });
    expect(await f.checkpoint(a)).toMatchObject({ dispatchPermit: false, state: "dispatch_pending", replayAllowed: false });
    await expect(f.invoke("releaseNotDispatched", { reference: f.reference, attemptId: a.attemptId })).rejects.toThrow();
    expect(f.account("tenant").reservedUnits).toBe(100);
  });
  it("changed final native request/proof and expired qualifications deny checkpoint", async () => {
    const { f, a } = await admitted(); const changed: ModelCallRequest = JSON.parse(a.requestCanonical) as ModelCallRequest; changed.outputTokens++;
    await expect(f.invoke("checkpoint", { reference: f.reference, attemptId: a.attemptId, requestCanonical: canonicalModelJson(changed) })).rejects.toThrow();
    jest.spyOn(Date, "now").mockReturnValue(root.dispatchEvidence[0]!.expiresAt);
    await expect(f.checkpoint(a)).rejects.toThrow(); expect(f.attempt(a.attemptId).state).toBe("reserved");
  });
  it("last operation/concurrency capacity applies across distinct children without partial rejection writes", async () => {
    const { f, b } = await admitted(); await f.admit(b, 1, "second"); const before = f.db.writes;
    await expect(f.admit(b, 2, "third")).rejects.toThrow(); expect(f.db.writes).toBe(before);
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 200, activeConcurrency: 2 });
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(2);
  });
  it("different backend request accounts share one tenant quota and concurrency", async () => {
    // Preflight succeeds before competitors consume capacity; admission must
    // independently enforce the shared quota after their reservations race.
    const f = fixture(); await f.install(); const first = await f.bind();
    const second = await f.bind("request2"); const third = await f.bind("request3");
    await f.admit(first); await f.admit(second, 0, "hello", { semanticId: "semantic-2" });
    const before = f.db.writes; await expect(f.admit(third, 0, "hello", { semanticId: "semantic-3" })).rejects.toThrow();
    expect(f.db.writes).toBe(before); expect(f.account("tenant").activeConcurrency).toBe(2);
  });
  it("known cost settles exactly once and eligible result replay needs no new reservation", async () => {
    const { f, b, a } = await admitted(); await f.checkpoint(a); expect(await f.settle(a)).toMatchObject({ state: "settled", settledCostUnits: 40, resultWithheld: false });
    const before = f.db.writes; await f.settle(a); expect(f.db.writes).toBe(before);
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 0, uncertainUnits: 0, activeConcurrency: 0 });
    expect(await f.admit(b)).toMatchObject({ status: "replay", resultCanonical: canonicalModelJson({ text: "answer" }) });
    await expect(f.settle(a, "0.000041")).rejects.toThrow(); expect(f.account("tenant").settledUnits).toBe(40);
  });
  it("invalid private results are withheld without erasing a known complete charge", async () => {
    const { f, b, a } = await admitted(); await f.checkpoint(a);
    expect(await f.settle(a, "0.000040", { privateResultCanonical: canonicalModelJson({ rawReasoning: "private" }) })).toMatchObject({ state: "settled", settledCostUnits: 40, resultWithheld: true });
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 0 });
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    expect(JSON.stringify(f.db.table("runtimeModelAttempts"))).not.toContain("rawReasoning");
    await expect(f.admit(b)).rejects.toThrow();
  });
  it("overrun accounts full spend and blocks further admission without rollback of charge", async () => {
    const { f, b, a } = await admitted(); await f.checkpoint(a); expect(await f.settle(a, "0.000150")).toMatchObject({ settledCostUnits: 150, overrun: true });
    expect(f.account("tenant")).toMatchObject({ settledUnits: 150, overrun: true, activeConcurrency: 0 });
    await expect(f.admit(b, 1)).rejects.toThrow();
  });
  it("malformed/missing cost remains unknown liability; qualified terminal proof releases slot only", async () => {
    const { f, b, a } = await admitted(); await f.checkpoint(a);
    expect(await f.invoke("settle", { reference: f.reference, attemptId: a.attemptId, receiptCanonical: "{\"bad\":true}" })).toMatchObject({ state: "uncertain", replayAllowed: false });
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 0, uncertainUnits: 100, activeConcurrency: 1 });
    const unknown = f.receipt(a); const parsed = JSON.parse(unknown) as Record<string, unknown>; delete parsed.aggregateCostUsd; parsed.costSource = "unavailable";
    await f.invoke("settle", { reference: f.reference, attemptId: a.attemptId, receiptCanonical: canonicalModelJson(parsed) });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, activeConcurrency: 0 });
    expect(await f.admit(b)).toMatchObject({ status: "uncertain", replayAllowed: false });
    await f.settle(a); expect(f.account("tenant")).toMatchObject({ uncertainUnits: 0, settledUnits: 40, activeConcurrency: 0 });
  });
  it("postcheckpoint crash recovery cannot claim no dispatch or zero cost", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    await f.invoke("recover", { reference: f.reference, attemptId: a.attemptId });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, activeConcurrency: 1 });
    expect(f.attempt(a.attemptId)).toMatchObject({ state: "uncertain", slotReleased: false });
    await expect(f.invoke("releaseNotDispatched", { reference: f.reference, attemptId: a.attemptId })).rejects.toThrow();
  });
  it("proved precheckpoint refusal releases balances and slots exactly once", async () => {
    const { f, a } = await admitted(); await f.invoke("releaseNotDispatched", { reference: f.reference, attemptId: a.attemptId });
    const before = f.db.writes; await f.invoke("releaseNotDispatched", { reference: f.reference, attemptId: a.attemptId }); expect(f.db.writes).toBe(before);
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 0, settledUnits: 0, activeConcurrency: 0 });
    expect(await f.invoke("checkFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "unqualified/model" })).toEqual({ allowed: false });
  });
  it("current admin may release proved precheckpoint liability after origin revocation without delivery", async () => {
    const { f, a } = await admitted(); f.grant.revokedAt = clock;
    const grant = f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:current-admin", version: 2 }); delete grant.revokedAt;
    const reference = { ...f.reference, grantId: grant._id, grantVersion: 2 };
    expect(await f.invoke("recover", { reference, attemptId: a.attemptId })).toEqual({ state: "not_dispatched", replayAllowed: false });
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 0, uncertainUnits: 0, settledUnits: 0, activeConcurrency: 0 });
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    await expect(f.checkpoint(a)).rejects.toThrow();
  });
  it("unknown liability blocks rollover; late receipt charges original immutable window", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); await f.invoke("recover", { reference: f.reference, attemptId: a.attemptId });
    const original = f.account("tenant").windowId;
    jest.spyOn(Date, "now").mockReturnValue(f.account("tenant").windowEnd + 1);
    await expect(f.bind("nextwindow")).rejects.toThrow(); await f.settle(a);
    expect(f.account("tenant")).toMatchObject({ windowId: original, settledUnits: 40, uncertainUnits: 0 });
    await f.bind("nextwindow"); expect(f.db.table("runtimeBudgetAccounts").filter((row) => row.kind === "tenant")).toHaveLength(2);
    const old = f.db.table("runtimeBudgetAccounts").find((row) => row.windowId === original && row.kind === "tenant"); expect(old?.settledUnits).toBe(40);
  });
  it("revoked originating grant requires current admin liability-only recovery", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    // Tenant tombstone denies original actor; only current separate admin recovery can account later.
    f.grant.revokedAt = clock;
    await expect(f.settle(a)).rejects.toThrow(); expect(f.account("tenant").reservedUnits).toBe(100);
    const secondGrant = f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:admin2", revokedAt: undefined, version: 2 });
    delete secondGrant.revokedAt;
    const adminReference = { ...f.reference, grantId: secondGrant._id, grantVersion: 2 };
    const receipt = f.receipt(a);
    expect(await f.invoke("recover", { reference: adminReference, attemptId: a.attemptId, receiptCanonical: receipt })).toMatchObject({ settledCostUnits: 40, resultWithheld: true });
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 0 });
  });
  it("monotone visibility flags and cancellation prevent later dispatch and safe fallback", async () => {
    const { f, b, a } = await admitted(); await f.checkpoint(a);
    const flags = { outputVisible: true, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false };
    await f.invoke("markVisible", { reference: f.reference, attemptId: a.attemptId, ...flags });
    const writes = f.db.writes;
    await f.invoke("markVisible", { reference: f.reference, attemptId: a.attemptId, ...flags, outputVisible: false });
    expect(f.db.writes).toBe(writes);
    expect(f.attempt(a.attemptId).outputVisible).toBe(true);
    await f.invoke("cancelBudget", { reference: f.reference, runBudgetId: b.runBudgetId });
    await expect(f.admit(b, 1)).rejects.toThrow();
    await expect(f.invoke("checkFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "unqualified/model" })).rejects.toThrow();
  });
  it("unchanged visibility still rechecks revocation and cannot bypass the native authorization fence", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    const flags = { reference: f.reference, attemptId: a.attemptId, outputVisible: true, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false };
    await f.invoke("markVisible", flags); f.grant.revokedAt = clock;
    const writes = f.db.writes;
    await expect(f.invoke("markVisible", flags)).rejects.toThrow();
    expect(f.db.writes).toBe(writes); expect(f.attempt(a.attemptId).outputVisible).toBe(true);
  });
  it("space admin cannot change global/root policy or install own tenant-wide constraints", async () => {
    const f = fixture(); await f.install(); const policy = { policyId: "tenant-rule", version: 1, scope: "deployment", rules: { limits: { tenantBudgetUnits: 999999 } } };
    await expect(f.invoke("provisionTenantPolicy", { reference: f.reference, policyCanonical: canonicalModelJson(policy) })).rejects.toThrow();
    expect(f.db.table("runtimeModelPolicies")).toHaveLength(1);
  });
  it("healthy tenant admin may narrow own rules but cannot forge prices or broaden caps", async () => {
    const f = fixture(); await f.install(); delete f.grant.memorySpaceId; delete f.grant.memorySpaceEpoch; f.grant.resourceAccess = "tenant";
    const reference = { ...f.reference }; delete reference.memorySpaceId; delete reference.memorySpaceEpoch;
    const policy = { policyId: "tenant-rule", version: 1, scope: "tenant", tenantId: "tenant-a", rules: { limits: { concurrency: 1 } } };
    expect(await f.invoke("provisionTenantPolicy", { reference, policyCanonical: canonicalModelJson(policy) })).toEqual({ policyId: "tenant-rule", version: 1 });
    for (const bad of [{ ...policy, tenantId: "foreign" }, { ...policy, version: 2, rules: { limits: { concurrency: 9 } } },
      { ...policy, version: 2, rules: { pins: { priceRevision: "made-up" } } }, { ...policy, scope: "deployment" }]) {
      await expect(f.invoke("provisionTenantPolicy", { reference, policyCanonical: canonicalModelJson(bad) })).rejects.toThrow();
    }
    expect(f.db.table("runtimeModelQualifications")).toHaveLength(1);
  });
  it("trusted own tenant override is backend-versioned and never broadens deployment hard bounds", async () => {
    const f = fixture(); await f.install(); delete f.grant.memorySpaceId; delete f.grant.memorySpaceEpoch; f.grant.resourceAccess = "tenant";
    const adminReference = { ...f.reference }; delete adminReference.memorySpaceId; delete adminReference.memorySpaceEpoch;
    await f.invoke("provisionTenantPolicy", { reference: adminReference, overrideRequested: true,
      policyCanonical: canonicalModelJson({ policyId: "override", version: 1, scope: "tenant", tenantId: "tenant-a", rules: { limits: { concurrency: 1 } } }) });
    // A tenant-wide grant is valid when narrowed to the concrete caller space by reference resolution.
    const b = await f.bind();
    const snapshot = await f.invoke("resolve", { reference: f.reference, operationKey: "agent.respond", runBudgetId: b.runBudgetId });
    expect(snapshot).toMatchObject({ snapshot: { limits: { concurrency: 1 }, policyVersions: [{ policyId: "deployment", version: 1 }, { policyId: "override", version: 1,
      override: { actorPrincipalId: f.reference.principalId, changeRevision: 1 } }] } });
    await expect(f.invoke("provisionTenantPolicy", { reference: adminReference, overrideRequested: true,
      policyCanonical: canonicalModelJson({ policyId: "override", version: 2, scope: "tenant", tenantId: "tenant-a", rules: { limits: { concurrency: 3 } } }) })).rejects.toThrow();
  });
  it("a current source tombstone blocks replay/delivery but retains already incurred charge", async () => {
    const f = fixture(); await f.install(); const b = await f.bind();
    const contentHash = await semanticHash("hello");
    const source = f.db.seed("runtimeMemorySources", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.reference.principalId,
      lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" }, content: "hello", contentHash, createdAt: clock });
    const a = await f.admit(b, 0, "hello", { source: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash } });
    await f.checkpoint(a); source.tombstonedAt = clock;
    expect(await f.settle(a)).toMatchObject({ settledCostUnits: 40, resultWithheld: true });
    expect(f.account("tenant").settledUnits).toBe(40); expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    await expect(f.admit(b, 0, "hello", { source: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash } })).rejects.toThrow();
  });
  it("source revision changes before checkpoint cannot dispatch or recreate source", async () => {
    const f = fixture(); await f.install(); const b = await f.bind(); const contentHash = await semanticHash("hello");
    const source = f.db.seed("runtimeMemorySources", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.reference.principalId,
      lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" }, content: "hello", contentHash, createdAt: clock });
    const a = await f.admit(b, 0, "hello", { source: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash } });
    source.lineage = { sourceId: "source", sourceEventId: "event", sourceRevision: 2, role: "user", trust: "user_assertion" };
    await expect(f.checkpoint(a)).rejects.toThrow(); expect(f.attempt(a.attemptId).state).toBe("reserved"); expect(f.db.table("runtimeMemorySources")).toHaveLength(1);
  });
  it("child operation inherits exact parent account and cancellation/current authority fences", async () => {
    const { f, b, a } = await admitted();
    const foreign = await f.bind("another");
    const child = await f.invoke<Reserved>("admit", { reference: f.reference, operationKey: "artifact.text", runBudgetId: b.runBudgetId, semanticId: "secondary", ordinal: 0,
      requestCanonical: canonicalModelJson(request()), parentOperationId: a.operationId });
    const operation = f.db.table("runtimeModelOperations").find((row) => row._id === a.operationId)!; operation.cancelled = true;
    await expect(f.checkpoint(child)).rejects.toThrow(); expect(f.attempt(child.attemptId).state).toBe("reserved");
    expect(f.account("tenant").reservedUnits).toBe(200);
    await expect(f.admit(foreign, 0, "hello", { semanticId: "foreignchild", parentOperationId: a.operationId })).rejects.toThrow();
  });
  it("validated owned executable specialization is consumed only by its current matching tenant/version", async () => {
    const f = fixture(); await f.install();
    const definitionCanonical = canonicalModelJson({ version: 1, agentId: "agent", agentVersion: 7, tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.reference.principalId,
      instructions: { text: "trusted server instruction", promptVersion: "prompt-1" }, tools: [],
      context: { handlerId: "cortex.transcript", handlerVersion: 1, registryHash: await definitions.executableRegistryHash(), memoryMode: "indexed-plus-pending", requiredStages: [], maxContextTokens: 1000 },
      policies: [{ policyId: "agent-policy", version: 1, scope: "agent", tenantId: "tenant-a", agentId: "agent", agentVersion: 7, rules: { limits: { outputTokens: 100, toolSteps: 0 } } }] });
    const definition = f.db.seed("runtimeAgentDefinitions", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.reference.principalId,
      agentId: "agent", version: 7, definitionCanonical, definitionHash: await semanticHash(definitionCanonical), authorReference: f.reference, createdAt: clock,
      publishPrincipalId: f.reference.principalId, publishIdentityCanonical: "fixture-owned-definition", publishIdentityHash: hash, publishRequestCanonical: definitionCanonical });
    expect(await definitions.readCurrentExecutableDefinition(f.ctx, f.reference, { agentId: "agent", version: 7 }, { capability: "run" })).toMatchObject({ definitionHash: definition.definitionHash });
    const binding = await f.invoke<Bound>("ensureBudget", { reference: f.reference, operationKey: "agent.respond", requestId: "agent-request", requestCanonical: canonicalModelJson({ text: "hello" }), agentId: "agent", agentVersion: 7 });
    expect(await f.invoke("resolve", { reference: f.reference, operationKey: "agent.respond", runBudgetId: binding.runBudgetId })).toMatchObject({ snapshot: { agent: { agentId: "agent", version: 7 }, limits: { outputTokens: 100 } } });
    await expect(f.invoke("ensureBudget", { reference: f.reference, operationKey: "agent.respond", requestId: "invalid-version", requestCanonical: canonicalModelJson({ text: "hello" }), agentId: "agent", agentVersion: 8 })).rejects.toThrow();
    definition.revokedAt = clock;
    await expect(f.invoke("resolve", { reference: f.reference, operationKey: "agent.respond", runBudgetId: binding.runBudgetId })).rejects.toThrow();
  });
  it("native bound rejects malformed Unicode, tool/schema shapes and part arrays without calling a provider", () => {
    const proof = root.dispatchEvidence[0]!;
    expect(ledger.deriveQualifiedInputBound(proof, request("é"))).toBe(12);
    expect(() => ledger.deriveQualifiedInputBound(proof, request("\ud800"))).toThrow();
    expect(() => ledger.deriveQualifiedInputBound(proof, { ...request(), messages: [{ role: "user", parts: [{ type: "text", text: "hello" }, { type: "text", text: "more" }] }] })).toThrow();
    expect(() => ledger.deriveQualifiedInputBound(proof, { ...request(), outputSchema: { type: "object" } })).toThrow();
  });
  it("embedding bound treats per-value and aggregate caps separately and counts normalized UTF8", () => {
    const proof: QualifiedDispatchEvidence = { ...root.dispatchEvidence[0]!, nativeInterface: "embedding", modelId: DEFAULT_EMBEDDING_PROFILE.modelId,
      inputBound: { ...root.dispatchEvidence[0]!.inputBound, ruleId: "default-embedding-utf8-v1", featureEnvelope: "default-embedding-v1" } };
    const embedding = { ...request(), messages: undefined, texts: ["é"], outputTokens: 0, profile: DEFAULT_EMBEDDING_PROFILE, batch: { ordinal: 0, start: 0, end: 1 } };
    expect(ledger.deriveQualifiedInputBound(proof, embedding)).toBe(2);
    expect(() => ledger.deriveQualifiedInputBound(proof, { ...embedding, texts: ["x".repeat(8193)] })).toThrow();
    expect(() => ledger.deriveQualifiedInputBound(proof, { ...embedding, texts: Array<string>(513).fill("x") })).toThrow();
    expect(() => ledger.deriveQualifiedInputBound(proof, { ...embedding, texts: Array<string>(40).fill("x".repeat(8192)) })).toThrow();
  });
  it("invalid terminal cost overflow remains unknown without refund or invented zero", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    expect(await f.settle(a, "9007199254740992")).toMatchObject({ state: "uncertain", replayAllowed: false });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, settledUnits: 0, activeConcurrency: 0 });
  });
  it("post-admission source/account corruption fails closed before checkpoint", async () => {
    const { f, a } = await admitted(); f.account("run").windowId = "substituted-window";
    await expect(f.checkpoint(a)).rejects.toThrow(); expect(f.attempt(a.attemptId).state).toBe("reserved");
  });
  it("explicit compatible safe fallback reserves once with pinned candidate and no lost prior spend", async () => {
    const q = root.qualifications[0]!; const proof = root.dispatchEvidence[0]!;
    root = { ...root, policies: [{ ...deployment, rules: { ...deployment.rules, allowedModels: [...deployment.rules.allowedModels!, "fixture/fallback"], fallbackModels: ["fixture/fallback"] } }],
      qualifications: [...root.qualifications, { ...q, receiptId: "synthetic-fallback", modelId: "fixture/fallback", costBound: { ...q.costBound, maximumCostUnits: 80 } }],
      dispatchEvidence: [...root.dispatchEvidence, { ...proof, receiptId: "synthetic-fallback", modelId: "fixture/fallback" }] };
    const { f, b, a } = await admitted();
    await f.invoke("releaseNotDispatched", { reference: f.reference, attemptId: a.attemptId });
    expect(await f.invoke("checkFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "fixture/fallback" })).toEqual({ allowed: true });
    const fallback = await f.invoke<Reserved>("admitFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "fixture/fallback" });
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 80, activeConcurrency: 1, settledUnits: 0 });
    expect(await f.invoke("admitFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "fixture/fallback" })).toMatchObject({ status: "inflight", attemptId: fallback.attemptId });
    expect(await f.checkpoint(fallback)).toMatchObject({ dispatchPermit: true });
    expect(await f.admit(b)).toMatchObject({ status: "uncertain", replayAllowed: false });
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(2);
  });
  it("visible output, unknown outcome and unqualified candidates deny fallback reservation", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    await f.invoke("markVisible", { reference: f.reference, attemptId: a.attemptId, outputVisible: true, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false });
    await f.invoke("recover", { reference: f.reference, attemptId: a.attemptId });
    const before = f.db.writes;
    await expect(f.invoke("admitFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "fixture/fallback" })).rejects.toThrow();
    expect(f.db.writes).toBe(before); expect(f.account("tenant").uncertainUnits).toBe(100);
  });
  it("storage bounds deny multi-vector calls and unbounded output before reservation", async () => {
    const proof = { ...root.dispatchEvidence[0]!, nativeInterface: "embedding" as const,
      inputBound: { ...root.dispatchEvidence[0]!.inputBound, ruleId: "default-embedding-utf8-v1" as const, featureEnvelope: "default-embedding-v1" as const } };
    expect(() => ledger.deriveQualifiedInputBound(proof, { ...request(), outputTokens: 0, texts: ["one", "two"] })).toThrow();
    root = { ...root, dispatchEvidence: root.dispatchEvidence.map((entry) => ({ ...entry, resultBound: { ...entry.resultBound, maximumOutputTokens: 10 } })) };
    const f = fixture(); await f.install(); const b = await f.bind(); const before = f.db.writes;
    await expect(f.admit(b)).rejects.toThrow(); expect(f.db.writes).toBe(before);
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  it("usage exceeding trusted input/output caps fully charges and blocks the faulty qualification", async () => {
    const { f, a, b } = await admitted(); await f.checkpoint(a);
    expect(await f.settle(a, "0.000040", { usage: { inputTokens: 100, outputTokens: 21 } })).toMatchObject({ settledCostUnits: 40, overrun: true });
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, overrun: true }); await expect(f.admit(b, 1)).rejects.toThrow();
  });
  it.each(["tenant", "memorySpace"])("retired %s blocks scoped actors while operator records full private overrun exactly once", async (kind) => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, ...(kind === "memorySpace" ? { memorySpaceId: f.reference.memorySpaceId } : {}), resourceType: kind,
      resourceId: kind === "tenant" ? f.reference.tenantId : f.reference.memorySpaceId, deletedAt: clock });
    await expect(f.settle(a, "0.000150")).rejects.toThrow();
    await expect(f.invoke("recover", { reference: f.reference, attemptId: a.attemptId, receiptCanonical: f.receipt(a, "0.000150") })).rejects.toThrow();
    const args = { attemptId: a.attemptId, receiptCanonical: f.receipt(a, "0.000150", { privateResultCanonical: "secret-unparsed-private" }) };
    expect(await f.invoke("reconcileDeploymentLiability", args)).toMatchObject({ settledCostUnits: 150, overrun: true, resultWithheld: true });
    await f.invoke("reconcileDeploymentLiability", args);
    expect(f.account("tenant")).toMatchObject({ settledUnits: 150, reservedUnits: 0, overrun: true, activeConcurrency: 0 });
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    expect(JSON.stringify(f.db.table("runtimeModelAttempts"))).not.toContain("secret-unparsed-private");
  });
  it("deployment liability route refuses live scopes and preserves retired unknown charge liability", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    const args = { attemptId: a.attemptId, receiptCanonical: f.receipt(a, "0.000040", { costSource: "unavailable" }) };
    await expect(f.invoke("reconcileDeploymentLiability", args)).rejects.toThrow();
    f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, resourceType: "tenant", resourceId: f.reference.tenantId, deletedAt: clock });
    expect(await f.invoke("reconcileDeploymentLiability", args)).toMatchObject({ state: "uncertain", replayAllowed: false });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, activeConcurrency: 0 });
  });
  it("all registrations are internal and their native argument schemas have no arbitrary payload escape", () => {
    const names = ["ensureBudget", "installDeploymentPolicy", "provisionTenantPolicy", "resolve", "admit", "checkpoint", "markVisible", "settle", "recover", "reconcileDeploymentLiability", "releaseNotDispatched", "cancelBudget", "cancelAgentBudget", "checkFallback", "admitFallback"] as const;
    for (const name of names) {
      const reg = ledger[name] as unknown as Registration; expect(reg.isInternal).toBe(true); expect(reg.isPublic).toBeUndefined();
      expect(reg.exportArgs?.()).not.toContain('"type":"any"');
    }
  });
  it("preserves all original native, transcript, Agent, ingestion and profile tables with nine graph tables, four asset tables and unique indexes", () => {
    const original = ["conversations", "conversationShares", "conversationSnapshots", "immutable", "mutable", "memories", "facts", "factHistory", "memorySpaces", "contexts", "agents", "sessions", "governancePolicies", "governanceEnforcement", "graphSyncQueue", "artifacts", "attachments",
      "runtimeAuthPrincipals", "runtimeAuthMemberships", "runtimeAuthScopes", "runtimeAuthGrants", "runtimeAuthTombstones", "runtimeMemorySources", "runtimeMemoryChunks", "runtimeMemoryVectors", "runtimeMemoryReceipts",
      "runtimeModelPolicies", "runtimeModelQualifications", "runtimeBudgetAccounts", "runtimeModelOperations", "runtimeModelAttempts",
      "cortexErasureReceipts", "cortexReferenceTargets", "cortexReferenceEdges", "cortexReferenceState"];
    const added = ["runtimeAgentDefinitions", "runtimeConversations", "runtimeConversationShares", "runtimeConversationSnapshots", "runtimeTranscriptMessages", "runtimeRuns", "runtimeRunOutbox", "runtimeRunAttempts", "runtimeTranscriptOutbox"];
    const execution = ["runtimeAgentExecutions", "runtimeAgentOutput", "runtimeAgentOperations", "runtimeAgentIngestion"];
    const ingestion = ["runtimeRunMemoryProgress", "runtimeIngestionSequenceHeads", "runtimeIngestionScopes", "runtimeIngestionEvents", "runtimeIngestionStages", "runtimeIngestionJobs", "runtimeBeliefHeads", "runtimeBeliefHistory", "runtimeBeliefOutbox"];
    const capture = ["runtimeMemoryCaptureConversations", "runtimeMemoryCaptures", "runtimeMemoryCaptureMessages"];
    const assets = ["runtimeAssets", "runtimeAssetVersions", "runtimeAssetReferences", "runtimeAssetJobs"];
    const media = ["runtimeMediaJobs", "runtimeMediaCallbacks"];
    const graph = ["runtimeGraphConnectors", "runtimeGraphScopes", "runtimeGraphRevisions", "runtimeGraphSources", "runtimeGraphPayloads", "runtimeGraphOutbox", "runtimeGraphReceipts", "runtimeGraphReads", "runtimeGraphDependencies"];
    expect(Object.keys(schema.tables).sort()).toEqual([...original, ...added, ...execution, ...ingestion, ...capture, "runtimeMemoryVectorGenerations", ...graph, ...assets, ...media, "runtimeContentJobs"].sort());
    const required = { runtimeContentJobs: ["by_job", "by_request", "by_account", "by_owner", "by_conversation"], runtimeMediaJobs: ["by_job", "by_request", "by_scope", "by_owner", "by_account", "by_operation"], runtimeMediaCallbacks: ["by_identity"], runtimeAssets: ["by_asset", "by_owner"], runtimeAssetVersions: ["by_version", "by_version_id", "by_storage", "by_cleanup"], runtimeAssetReferences: ["by_version", "by_owner", "by_principal", "by_scope", "by_conversation"], runtimeAssetJobs: ["by_request", "by_job", "by_owner", "by_scope"], runtimeMemoryVectorGenerations: ["by_scope", "by_owner", "by_scope_profile_source"], runtimeAgentExecutions: ["by_attempt"], runtimeAgentOutput: ["by_sequence", "by_delivery"], runtimeAgentOperations: ["by_operation", "by_attempt"], runtimeAgentIngestion: ["by_run"],
      runtimeRunMemoryProgress: ["by_run"], runtimeMemoryCaptureConversations: ["by_conversation"], runtimeMemoryCaptures: ["by_request", "by_receipt"], runtimeMemoryCaptureMessages: ["by_message", "by_receipt"],
      runtimeIngestionSequenceHeads: ["by_scope"], runtimeIngestionScopes: ["by_scope"], runtimeIngestionEvents: ["by_event", "by_scope_sequence", "by_owner_sequence", "by_source", "by_source_eligibility", "by_conversation_sequence"],
      runtimeIngestionStages: ["by_event_stage"], runtimeIngestionJobs: ["by_event", "by_budget", "by_account"],
      runtimeBeliefHeads: ["by_slot"], runtimeBeliefHistory: ["by_fact", "by_event"], runtimeBeliefOutbox: ["by_event"],
      runtimeGraphConnectors: ["by_connector", "by_scope"], runtimeGraphScopes: ["by_scope"], runtimeGraphRevisions: ["by_scope_revision"],
      runtimeGraphSources: ["by_source", "by_scope", "by_tenant_source", "by_conversation", "by_grant", "by_principal", "by_membership"], runtimeGraphPayloads: ["by_revision"],
      runtimeGraphDependencies: ["by_upstream", "by_dependent"],
      runtimeGraphOutbox: ["by_job", "by_queue", "by_source"], runtimeGraphReceipts: ["by_job"], runtimeGraphReads: ["by_request", "by_queue"] } as const;
    for (const [name, indexes] of Object.entries(required)) {
      expect(schema.tables[name as keyof typeof required][" indexes"]().map(index => index.indexDescriptor).sort()).toEqual([...indexes].sort());
    }
    for (const definition of Object.values(schema.tables)) {
      const configurations = definition[" indexes"]().map((index) => JSON.stringify(index.fields));
      expect(new Set(configurations).size).toBe(configurations.length);
    }
  });
  it.each([["0", 0], ["0.0000001", 1], ["0.000001", 1], ["1.23456789", 1234568]])("rounds authoritative %s USD upward to %s microUSD", (usd, expected) => {
    expect(ledger.costMicroUnits(usd)).toBe(expected);
  });
  it.each(["NaN", "Infinity", "-1", "1e4", "9007199254740992"])("rejects invalid or overflowing money %s", (value) => {
    expect(() => ledger.costMicroUnits(value)).toThrow();
  });
});


describe("current policy narrowing at fallback and dispatch boundaries", () => {
  function fallbackRoot() {
    const q = root.qualifications[0]!; const proof = root.dispatchEvidence[0]!;
    root = { ...root, policies: [{ ...deployment, rules: { ...deployment.rules, allowedModels: [...deployment.rules.allowedModels!, "fixture/fallback"], fallbackModels: ["fixture/fallback"] } }],
      qualifications: [...root.qualifications, { ...q, receiptId: "synthetic-fallback", modelId: "fixture/fallback", costBound: { ...q.costBound, maximumCostUnits: 80 } }],
      dispatchEvidence: [...root.dispatchEvidence, { ...proof, receiptId: "synthetic-fallback", modelId: "fixture/fallback" }] };
  }
  async function narrow(f: ReturnType<typeof fixture>, rules: unknown) {
    delete f.grant.memorySpaceId; delete f.grant.memorySpaceEpoch; f.grant.resourceAccess = "tenant";
    const reference = { ...f.reference }; delete reference.memorySpaceId; delete reference.memorySpaceEpoch;
    await f.invoke("provisionTenantPolicy", { reference, policyCanonical: canonicalModelJson({ policyId: "current-narrowing", version: 1, scope: "tenant", tenantId: f.reference.tenantId, rules }) });
  }
  function effects(f: ReturnType<typeof fixture>) {
    return { writes: f.db.writes, rows: canonicalModelJson([f.db.table("runtimeBudgetAccounts"), f.db.table("runtimeModelOperations"), f.db.table("runtimeModelAttempts")]) };
  }
  async function deniedWithoutEffects(f: ReturnType<typeof fixture>, action: () => Promise<unknown>) {
    const before = effects(f); await expect(action()).rejects.toThrow(); expect(effects(f)).toEqual(before);
  }
  async function rejectedOriginal() {
    fallbackRoot(); const state = await admitted(); await state.f.checkpoint(state.a);
    await state.f.settle(state.a, "0.000040", { outcome: "confirmed_rejected", privateResultCanonical: "" }); return state;
  }
  const fallbackArgs = (f: ReturnType<typeof fixture>, a: Reserved) => ({ reference: f.reference, attemptId: a.attemptId, candidateModelId: "fixture/fallback" });
  it("an expired unused fallback does not block the selected original but cannot reserve a replacement", async () => {
    fallbackRoot(); root = { ...root, dispatchEvidence: root.dispatchEvidence.map(proof => proof.receiptId === "synthetic-fallback"
      ? { ...proof, checkedAt: clock - 10_000, expiresAt: clock - 1 } : proof) };
    const { f, a } = await admitted(); await f.checkpoint(a);
    await f.settle(a, "0.000040", { outcome: "confirmed_rejected", privateResultCanonical: "" });
    const before = effects(f);
    expect(await f.invoke("checkFallback", fallbackArgs(f, a))).toEqual({ allowed: false });
    await deniedWithoutEffects(f, () => f.invoke("admitFallback", fallbackArgs(f, a)));
    expect(effects(f)).toEqual(before); expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 0, activeConcurrency: 0 });
  });
  it("fallback expiry denies same-attempt replay and checkpoint without releasing its existing reservation", async () => {
    fallbackRoot(); root = { ...root, dispatchEvidence: root.dispatchEvidence.map(proof => proof.receiptId === "synthetic-fallback" ? { ...proof, expiresAt: clock + 10 } : proof) };
    const { f, a } = await admitted(); await f.checkpoint(a);
    await f.settle(a, "0.000040", { outcome: "confirmed_rejected", privateResultCanonical: "" });
    const candidate = await f.invoke<Reserved>("admitFallback", fallbackArgs(f, a));
    jest.spyOn(Date, "now").mockReturnValue(clock + 10);
    expect(await f.invoke("checkFallback", fallbackArgs(f, a))).toEqual({ allowed: false });
    await deniedWithoutEffects(f, () => f.invoke("admitFallback", fallbackArgs(f, a)));
    await deniedWithoutEffects(f, () => f.checkpoint(candidate));
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 80, activeConcurrency: 1 });
  });
  it("fresh fallback includes prior known spend under current narrowed operation ceiling", async () => {
    const { f, a } = await rejectedOriginal(); await narrow(f, { limits: { operationBudgetUnits: 100 } });
    await deniedWithoutEffects(f, () => f.invoke("admitFallback", fallbackArgs(f, a)));
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 0 });
  });
  it("current fallback revocation denies fresh reservation and query even with generally allowed model", async () => {
    const { f, a } = await rejectedOriginal(); await narrow(f, { fallbackModels: [] });
    expect(await f.invoke("checkFallback", fallbackArgs(f, a))).toEqual({ allowed: false });
    await deniedWithoutEffects(f, () => f.invoke("admitFallback", fallbackArgs(f, a)));
  });
  it.each(["operation", "run", "tenant", "concurrency"])("checkpoint preserves liabilities and denies narrowed current %s aggregate", async (kind) => {
    const { f, a, b } = await admitted();
    const secondBinding = kind === "tenant" ? await f.bind("another-run") : b;
    const second = await f.admit(secondBinding, 1, "second", kind === "run" || kind === "tenant" ? { semanticId: "another-operation" } : {});
    const tighter = kind === "operation" ? { operationBudgetUnits: 150 } : kind === "run" ? { operationBudgetUnits: 150, runBudgetUnits: 150 }
      : kind === "tenant" ? { operationBudgetUnits: 150, runBudgetUnits: 150, tenantBudgetUnits: 150 } : { concurrency: 1 };
    await narrow(f, { limits: tighter }); await deniedWithoutEffects(f, () => f.checkpoint(second));
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 200, activeConcurrency: 2 }); expect(f.attempt(a.attemptId).state).toBe("reserved");
  });
  it("fallback permission revoked after valid reservation denies checkpoint with zero effects", async () => {
    const { f, a } = await rejectedOriginal(); const candidate = await f.invoke<Reserved>("admitFallback", fallbackArgs(f, a));
    await narrow(f, { fallbackModels: [] }); await deniedWithoutEffects(f, () => f.checkpoint(candidate));
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 80, settledUnits: 40, activeConcurrency: 1 });
  });
  it("operation narrowing after valid fallback reserve preserves full original liability and denies permit", async () => {
    const { f, a } = await rejectedOriginal(); const candidate = await f.invoke<Reserved>("admitFallback", fallbackArgs(f, a));
    await narrow(f, { limits: { operationBudgetUnits: 100 } }); await deniedWithoutEffects(f, () => f.checkpoint(candidate));
    expect(f.account("run")).toMatchObject({ reservedUnits: 80, settledUnits: 40 });
  });
  it("aggregate at exact current caps permits held reservation without charging it twice", async () => {
    const { f, b } = await admitted(); const second = await f.admit(b, 1, "second");
    await narrow(f, { limits: { operationBudgetUnits: 200, runBudgetUnits: 200, tenantBudgetUnits: 200, concurrency: 2 } });
    expect(await f.checkpoint(second)).toMatchObject({ dispatchPermit: true });
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 200, settledUnits: 0, activeConcurrency: 2 });
  });
  it("compatible fallback at exact narrowed cumulative ceiling remains permitted", async () => {
    const { f, a } = await rejectedOriginal(); await narrow(f, { limits: { operationBudgetUnits: 120 } });
    expect(await f.invoke("checkFallback", fallbackArgs(f, a))).toEqual({ allowed: true });
    const candidate = await f.invoke<Reserved>("admitFallback", fallbackArgs(f, a)); expect(await f.checkpoint(candidate)).toMatchObject({ dispatchPermit: true });
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 80 });
  });
});

/** Actual registered B handlers and the installed registration serializer; synthetic DB only. */
describe("native structured PURE denial boundary", () => {
  async function denial(call: () => Promise<unknown>, code: string, outcome = "not_dispatched") {
    const { ConvexError } = await import("convex/values");
    let error: unknown;
    try { await call(); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(ConvexError);
    expect((error as InstanceType<typeof ConvexError>).data).toEqual({ version: 1, code,
      message: "Model operation control failed.", retryable: false, outcome });
    return error;
  }
  function state(f: ReturnType<typeof fixture>) {
    return JSON.stringify([f.db.table("runtimeBudgetAccounts"), f.db.table("runtimeModelOperations"), f.db.table("runtimeModelAttempts")]);
  }
  it("changed existing admitted canonical is a structured identity denial with exact unchanged ledger", async () => {
    const { f, b } = await admitted(); const before = state(f), writes = f.db.writes;
    await denial(() => f.admit(b, 0, "changed private input"), "IDEMPOTENCY_CONFLICT");
    expect(state(f)).toBe(before); expect(f.db.writes).toBe(writes);
  });
  it("forced equal hash cannot hide changed canonical or change original reservation", async () => {
    const { f, b, a } = await admitted();
    f.attempt(a.attemptId).canonical = canonicalModelJson({ forcedCollision: "different canonical with original hash" });
    const before = state(f), writes = f.db.writes;
    await denial(() => f.admit(b), "IDEMPOTENCY_CONFLICT");
    expect(state(f)).toBe(before); expect(f.db.writes).toBe(writes);
  });
  it.each([
    ["INVALID_INPUT", { options: { maxRetries: 1 } }],
    ["POLICY_DENIED", { options: { maxRetries: 0, topP: 0.5 } }],
    ["POLICY_DENIED", { promptVersion: "untrusted-prompt" }],
    ["POLICY_DENIED", { timeoutMs: 10001 }],
  ])("request contract denial %s preserves all original accounts and attempts", async (code, change) => {
    const { f, b } = await admitted(); const before = state(f), writes = f.db.writes;
    await denial(() => f.admit(b, 1, "hello", { requestCanonical: canonicalModelJson({ ...request(), ...change }) }), code as string);
    expect(state(f)).toBe(before); expect(f.db.writes).toBe(writes);
  });
  it("malformed resolver contract preserves its source-defined code before installation writes", async () => {
    root = { ...root, policies: [{ ...deployment, rules: { ...deployment.rules, limits: undefined } }] };
    const f = fixture(); const before = state(f);
    await denial(() => f.install(), "INVALID_INPUT", "uncertain");
    expect(state(f)).toBe(before); expect(f.db.writes).toBe(0);
  });
  it.each(["CAPABILITY_UNSUPPORTED", "CAPABILITY_UNAVAILABLE"])("resolver retains exact %s without installation effects", async (code) => {
    const rules = code === "CAPABILITY_UNSUPPORTED" ? { ...deployment.rules, allowedModels: [DEFAULT_EMBEDDING_PROFILE.modelId] } : {
      ...deployment.rules, modelId: "fixture/unqualified", allowedModels: ["fixture/unqualified"] };
    root = { ...root, policies: [{ ...deployment, rules }] };
    const f = fixture(); const before = state(f);
    await denial(() => f.install(), code, "uncertain");
    expect(state(f)).toBe(before); expect(f.db.writes).toBe(0);
  });
  it("checkpoint changed canonical emits identity code without permit or ledger effects", async () => {
    const { f, a } = await admitted();
    f.attempt(a.attemptId).canonical = canonicalModelJson({ forcedCollision: "checkpoint canonical mismatch" });
    const before = state(f), writes = f.db.writes;
    await denial(() => f.checkpoint(a), "IDEMPOTENCY_CONFLICT");
    expect(state(f)).toBe(before); expect(f.db.writes).toBe(writes);
  });
  it("conflicting settled receipt preserves incurred money and returns conservative outcome", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); await f.settle(a);
    const before = state(f), writes = f.db.writes;
    await denial(() => f.settle(a, "0.000041"), "IDEMPOTENCY_CONFLICT", "uncertain");
    expect(state(f)).toBe(before); expect(f.db.writes).toBe(writes);
    expect(f.account("tenant").settledUnits).toBe(40);
  });
  it("installed serializer emits genuine Convex errorData for the actual registered handler denial", async () => {
    // Installed private registration runtime has no declaration entrypoint.
    const registrationImplPath = "../../../node_modules/convex/dist/esm/server/impl/registration_impl.js";
    const { invokeFunction } = await import(registrationImplPath) as {
      invokeFunction: (handler: Registration["_handler"], ctx: MutationCtx, args: [unknown]) => Promise<unknown>;
    };
    const { jsonToConvex, ConvexError } = await import("convex/values");
    const { f, b } = await admitted(); const before = state(f), writes = f.db.writes;
    const registration = ledger.admit as unknown as Registration;
    let error: unknown;
    try { await invokeFunction(registration._handler, f.ctx, [{ reference: f.reference,
      operationKey: "agent.respond", runBudgetId: b.runBudgetId, semanticId: "semantic", ordinal: 0,
      requestCanonical: canonicalModelJson(request("changed private input")) }]); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(ConvexError);
    const errorData = (error as InstanceType<typeof ConvexError>).data;
    expect(typeof errorData).toBe("string");
    expect(jsonToConvex(JSON.parse(errorData as string))).toEqual({ version: 1, code: "IDEMPOTENCY_CONFLICT",
      message: "Model operation control failed.", retryable: false, outcome: "not_dispatched" });
    expect(String(errorData)).not.toContain("changed private input");
    expect(state(f)).toBe(before); expect(f.db.writes).toBe(writes);
  });
});

/** Terminal capture extension: fake transactions/serialization are offline logic, never native OCC evidence. */
describe("trusted terminal capture and current private attachment", () => {
  type Capture = { evidenceId: string; state: string; settledCostUnits?: number; overrun: boolean };
  function charge(f: ReturnType<typeof fixture>, a: Reserved, cost?: string, extra: Record<string, unknown> = {}) {
    const parsed = JSON.parse(f.receipt(a, cost ?? "0.000040")) as Record<string, unknown>;
    delete parsed.privateResultCanonical;
    if (cost === undefined) { delete parsed.aggregateCostUsd; parsed.costSource = "unavailable"; }
    return canonicalModelJson({ ...parsed, ...extra });
  }
  async function capture(f: ReturnType<typeof fixture>, a: Reserved, encoded: string) {
    return await f.invoke<Capture>("captureTerminalEvidence", { attemptId: a.attemptId,
      dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical: encoded });
  }
  async function attach(f: ReturnType<typeof fixture>, a: Reserved, evidenceId: string, result = canonicalModelJson({ text: "answer" }), reference = f.reference) {
    return await f.invoke("attachTerminalResult", { reference, attemptId: a.attemptId, evidenceId, privateResultCanonical: result });
  }
  function ledgerState(f: ReturnType<typeof fixture>) { return JSON.stringify([...f.db.rows]); }
  async function unchanged(f: ReturnType<typeof fixture>, call: () => Promise<unknown>) {
    const before = ledgerState(f), writes = f.db.writes;
    await expect(call()).rejects.toThrow(); expect(ledgerState(f)).toBe(before); expect(f.db.writes).toBe(writes);
  }
  it("healthy charge capture and attachment are separate, monetary once, exact-current retries zero writes", async () => {
    const { f, b, a } = await admitted(); await f.checkpoint(a);
    const encoded = charge(f, a, "0.000040"), captured = await capture(f, a, encoded);
    expect(captured).toMatchObject({ state: "settled", settledCostUnits: 40, overrun: false });
    expect(f.attempt(a.attemptId)).toMatchObject({ resultAttachmentState: "pending", resultWithheld: true, outputVisible: false, terminalEvidenceCanonical: encoded });
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    const money = JSON.stringify(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
    expect(await capture(f, a, encoded)).toEqual(captured); expect(f.db.writes).toBe(writes);
    expect(await attach(f, a, captured.evidenceId)).toEqual({ attached: true, resultWithheld: false });
    expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(money);
    expect(f.attempt(a.attemptId)).toMatchObject({ resultAttachmentState: "attached", outputVisible: true });
    expect(await f.admit(b)).toMatchObject({ status: "replay", resultCanonical: canonicalModelJson({ text: "answer" }) });
    const attachedWrites = f.db.writes;
    expect(await attach(f, a, captured.evidenceId)).toEqual({ attached: true, resultWithheld: false });
    expect(await capture(f, a, encoded)).toEqual(captured); expect(f.db.writes).toBe(attachedWrites);
    await unchanged(f, () => attach(f, a, captured.evidenceId, canonicalModelJson({ text: "changed" })));
    f.grant.revokedAt = clock;
    expect(await attach(f, a, captured.evidenceId)).toEqual({ attached: false, resultWithheld: true });
    expect(f.db.writes).toBe(attachedWrites); await expect(f.admit(b)).rejects.toThrow();
  });
  it("live revoked origin unknown100 refines full150 once without admin, slot decrement or reopened attachment", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    const initial = charge(f, a), first = await capture(f, a, initial);
    expect(first).toMatchObject({ state: "uncertain", overrun: false });
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 0, uncertainUnits: 100, activeConcurrency: 0 });
    const originalHash = f.attempt(a.attemptId).terminalEvidenceHash, before = f.db.writes;
    expect(await capture(f, a, initial)).toEqual(first); expect(f.db.writes).toBe(before);
    f.grant.revokedAt = clock;
    const final = charge(f, a, "0.000150", { actualModel: "openai/gpt-4o-mini", usage: { inputTokens: 15, outputTokens: 20 } });
    const refined = await capture(f, a, final);
    expect(refined).toEqual({ evidenceId: first.evidenceId, state: "settled", settledCostUnits: 150, overrun: true });
    for (const kind of ["run", "tenant"]) expect(f.account(kind)).toMatchObject({ reservedUnits: 0, uncertainUnits: 0, settledUnits: 150, activeConcurrency: 0, overrun: true });
    expect(f.db.table("runtimeModelOperations")[0]).toMatchObject({ settledUnits: 150, uncertainUnits: 0, overrun: true });
    expect(f.attempt(a.attemptId)).toMatchObject({ terminalEvidenceCanonical: initial, terminalEvidenceHash: originalHash, receiptCanonical: final, resultAttachmentState: "closed" });
    const writes = f.db.writes;
    expect(await capture(f, a, initial)).toEqual(refined); expect(await capture(f, a, final)).toEqual(refined); expect(f.db.writes).toBe(writes);
    delete f.grant.revokedAt;
    expect(await attach(f, a, first.evidenceId)).toEqual({ attached: false, resultWithheld: true });
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined(); expect(f.db.writes).toBe(writes);
    await unchanged(f, () => capture(f, a, charge(f, a, "0.000151", { actualModel: "openai/gpt-4o-mini", usage: { inputTokens: 15, outputTokens: 20 } })));
  });
  it.each(["settle", "recover", "reconcileDeploymentLiability"] as const)("%s compatible refinement preserves immutable closed capture and discards receipt private payload", async (route) => {
    const { f, a } = await admitted(); await f.checkpoint(a); const initial = charge(f, a);
    const first = await capture(f, a, initial); f.grant.revokedAt = clock; delete f.grant.revokedAt;
    if (route === "reconcileDeploymentLiability") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, resourceType: "tenant", resourceId: f.reference.tenantId, deletedAt: clock });
    const args = { attemptId: a.attemptId, receiptCanonical: f.receipt(a, "0.000150"), ...(route !== "reconcileDeploymentLiability" ? { reference: f.reference } : {}) };
    expect(await f.invoke(route, args)).toMatchObject({ settledCostUnits: 150, overrun: true, resultWithheld: true });
    expect(f.attempt(a.attemptId)).toMatchObject({ terminalEvidenceCanonical: initial, resultAttachmentState: "closed" });
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    const writes = f.db.writes;
    expect(await capture(f, a, initial)).toMatchObject({ evidenceId: first.evidenceId, settledCostUnits: 150 });
    await f.invoke(route, args); expect(f.db.writes).toBe(writes);
  });
  it("writeUnknown/recover cannot overwrite initial unknown or downgrade captured known liability", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); const initial = charge(f, a); await capture(f, a, initial);
    let writes = f.db.writes;
    await f.invoke("recover", { reference: f.reference, attemptId: a.attemptId });
    await f.invoke("settle", { reference: f.reference, attemptId: a.attemptId, receiptCanonical: canonicalModelJson({ bad: true }) });
    expect(f.db.writes).toBe(writes); expect(f.attempt(a.attemptId).terminalEvidenceCanonical).toBe(initial);
    await capture(f, a, charge(f, a, "0.000040")); writes = f.db.writes;
    await f.invoke("recover", { reference: f.reference, attemptId: a.attemptId }); expect(f.db.writes).toBe(writes);
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 0, settledUnits: 40, activeConcurrency: 0 });
  });
  it.each(["receiptId", "outcome", "actualModel", "usageChanged", "usageRemoved", "unknownVariant"])("rejects incompatible %s with zero ledger effects", async (variant) => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    await capture(f, a, charge(f, a, undefined, { actualModel: "openai/gpt-4o-mini", usage: { inputTokens: 15 } }));
    const extra: Record<string, unknown> = { actualModel: "openai/gpt-4o-mini", usage: { inputTokens: 15 } };
    if (variant === "receiptId") extra.receiptId = "different";
    if (variant === "outcome") extra.outcome = "confirmed_rejected";
    if (variant === "actualModel") extra.actualModel = "foreign/model";
    if (variant === "usageChanged") extra.usage = { inputTokens: 14 };
    if (variant === "usageRemoved") delete extra.usage;
    if (variant === "unknownVariant") extra.usage = { inputTokens: 15, outputTokens: 20 };
    await unchanged(f, () => capture(f, a, charge(f, a, variant === "unknownVariant" ? undefined : "0.000040", extra)));
  });
  it.each(["private", "raw", "proof", "identity", "usage", "noncanonical", "oversized"])("invalid first capture %s cannot create terminal proof or release slot", async (variant) => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    let encoded = charge(f, a, "0.000040"); const data = JSON.parse(encoded) as Record<string, unknown>;
    if (variant === "private") data.privateResultCanonical = canonicalModelJson({ text: "secret" });
    if (variant === "raw") data.rawProviderResponse = "secret";
    if (variant === "proof") data.proof = "claimed";
    if (variant === "identity") data.dispatchIdentity = "foreign";
    if (variant === "usage") data.usage = { inputTokens: -1 };
    encoded = canonicalModelJson(data);
    if (variant === "noncanonical") encoded = " " + encoded;
    if (variant === "oversized") encoded = '"' + "x".repeat(180001) + '"';
    await unchanged(f, () => capture(f, a, encoded));
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 100, activeConcurrency: 1 });
  });
  it("no checkpoint, no-dispatch and wrong producer dispatch identity deny with zero writes", async () => {
    const { f, a } = await admitted(); await unchanged(f, () => capture(f, a, charge(f, a, "0.000040")));
    await f.invoke("releaseNotDispatched", { reference: f.reference, attemptId: a.attemptId });
    await unchanged(f, () => capture(f, a, charge(f, a, "0.000040")));
    const second = await admitted(); await second.f.checkpoint(second.a);
    await unchanged(second.f, () => second.f.invoke("captureTerminalEvidence", { attemptId: second.a.attemptId, dispatchIdentity: "wrong", receiptCanonical: charge(second.f, second.a, "0.000040") }));
  });
  it.each(["tenant", "memorySpace", "cancelled", "revoked"])("first charge after %s closes attachment while accounting full original-window cost", async (kind) => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    const ids = [f.account("tenant")._id, f.account("run")._id], windows = [f.account("tenant").windowId, f.account("run").windowId];
    if (kind === "revoked") f.grant.revokedAt = clock;
    else if (kind === "cancelled") await f.invoke("cancelBudget", { reference: f.reference, runBudgetId: f.account("run").runBudgetId });
    else f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, ...(kind === "memorySpace" ? { memorySpaceId: f.reference.memorySpaceId } : {}), resourceType: kind, resourceId: kind === "tenant" ? f.reference.tenantId : f.reference.memorySpaceId, deletedAt: clock });
    jest.spyOn(Date, "now").mockReturnValue(clock + 120000);
    const captured = await capture(f, a, charge(f, a, "0.000150"));
    expect(captured).toMatchObject({ settledCostUnits: 150, overrun: true });
    expect([f.account("tenant")._id, f.account("run")._id]).toEqual(ids); expect([f.account("tenant").windowId, f.account("run").windowId]).toEqual(windows);
    expect(f.attempt(a.attemptId)).toMatchObject({ resultAttachmentState: "closed", slotReleased: true });
    expect(await attach(f, a, captured.evidenceId)).toEqual({ attached: false, resultWithheld: true });
  });
  it("source deletion after healthy capture withholds attachment and money is retained", async () => {
    const f = fixture(); await f.install(); const b = await f.bind(); const contentHash = await semanticHash("hello");
    const source = f.db.seed("runtimeMemorySources", { tenantId: "tenant-a", memorySpaceId: "space-a", ownerPrincipalId: f.reference.principalId,
      lineage: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, role: "user", trust: "user_assertion" }, content: "hello", contentHash, createdAt: clock });
    const a = await f.admit(b, 0, "hello", { source: { sourceId: "source", sourceEventId: "event", sourceRevision: 1, contentHash } });
    await f.checkpoint(a); const captured = await capture(f, a, charge(f, a, "0.000040")); source.tombstonedAt = clock;
    const writes = f.db.writes; expect(await attach(f, a, captured.evidenceId)).toEqual({ attached: false, resultWithheld: true });
    expect(f.db.writes).toBe(writes + 1); expect(f.attempt(a.attemptId).resultAttachmentState).toBe("closed");
    expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined(); expect(f.account("tenant").settledUnits).toBe(40);
  });
  it("legacy terminal private result survives exact capture acknowledgment without new attachment privilege", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); await f.settle(a);
    const before = ledgerState(f), writes = f.db.writes;
    const captured = await capture(f, a, charge(f, a, "0.000040"));
    expect(ledgerState(f)).toBe(before); expect(f.db.writes).toBe(writes);
    expect(f.attempt(a.attemptId).privateResultCanonical).toBe(canonicalModelJson({ text: "answer" }));
    expect(await attach(f, a, captured.evidenceId, canonicalModelJson({ text: "different" }))).toEqual({ attached: false, resultWithheld: true });
    await unchanged(f, () => capture(f, a, charge(f, a, "0.000041")));
  });
  it.each(["hashOnly", "stateOnly"])("partial marker %s fails closed on capture, attachment, ordinary settle and recovery", async (variant) => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    if (variant === "hashOnly") f.attempt(a.attemptId).terminalEvidenceHash = hash;
    else f.attempt(a.attemptId).resultAttachmentState = "pending";
    await unchanged(f, () => capture(f, a, charge(f, a, "0.000040")));
    await unchanged(f, () => attach(f, a, hash)); await unchanged(f, () => f.settle(a));
    await unchanged(f, () => f.invoke("recover", { reference: f.reference, attemptId: a.attemptId }));
  });
  it("legacy unknown terminal evidence cannot receive pending result privilege", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a);
    await f.invoke("settle", { reference: f.reference, attemptId: a.attemptId, receiptCanonical: charge(f, a) });
    const writes = f.db.writes, before = ledgerState(f);
    const captured = await capture(f, a, charge(f, a));
    expect(f.attempt(a.attemptId).resultAttachmentState).toBeUndefined();
    expect(await attach(f, a, captured.evidenceId)).toEqual({ attached: false, resultWithheld: true });
    await unchanged(f, () => capture(f, a, charge(f, a, "0.000040")));
    expect(f.db.writes).toBe(writes); expect(ledgerState(f)).toBe(before);
  });
  it("invalid result/current reference/evidence cannot attach and never writes money", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); const captured = await capture(f, a, charge(f, a, "0.000040"));
    const before = ledgerState(f), writes = f.db.writes;
    expect(await attach(f, a, captured.evidenceId, canonicalModelJson({ rawReasoning: "secret" }))).toEqual({ attached: false, resultWithheld: true });
    expect(await attach(f, a, captured.evidenceId, canonicalModelJson({ text: "answer" }), { ...f.reference, grantVersion: 2 })).toEqual({ attached: false, resultWithheld: true });
    await unchanged(f, () => attach(f, a, "wrong")); expect(ledgerState(f)).toBe(before); expect(f.db.writes).toBe(writes);
  });
  it("rejected terminal captures close attachment and known charge remains exact", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); const captured = await capture(f, a, charge(f, a, "0.000010", { outcome: "confirmed_rejected" }));
    expect(captured).toMatchObject({ state: "confirmed_rejected", settledCostUnits: 10 });
    expect(f.attempt(a.attemptId).resultAttachmentState).toBe("closed"); expect(await attach(f, a, captured.evidenceId)).toEqual({ attached: false, resultWithheld: true });
  });
  it("offline parent fault rolls back refinement; exact lost-response retry has one delta", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); const initial = charge(f, a), first = await capture(f, a, initial), final = charge(f, a, "0.000150");
    const before = ledgerState(f), writes = f.db.writes;
    // JSON snapshots retain this fixture's plain object realm; native rollback remains a separate gate.
    const transaction = async <T,>(run: () => Promise<T>) => {
      const snapshot = JSON.parse(JSON.stringify([...f.db.rows])) as [string, ReturnType<typeof f.db.table>][];
      const oldWrites = f.db.writes;
      try { return await run(); } catch (error) { f.db.rows = new Map(snapshot); f.db.writes = oldWrites; throw error; }
    };
    await expect(transaction(async () => { await capture(f, a, final); throw new Error("parent fault"); })).rejects.toThrow("parent fault");
    expect(ledgerState(f)).toBe(before); expect(f.db.writes).toBe(writes);
    const refined = await transaction(() => capture(f, a, final));
    expect(refined).toMatchObject({ evidenceId: first.evidenceId, settledCostUnits: 150 });
    const post = ledgerState(f), postWrites = f.db.writes;
    expect(await capture(f, a, final)).toEqual(refined); expect(ledgerState(f)).toBe(post); expect(f.db.writes).toBe(postWrites);
  });
  it("offline serialized equal/conflicting candidates account once (not native OCC)", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); await capture(f, a, charge(f, a));
    const final = charge(f, a, "0.000150"); await capture(f, a, final); const writes = f.db.writes;
    await capture(f, a, final); await unchanged(f, () => capture(f, a, charge(f, a, "0.000151")));
    expect(f.db.writes).toBe(writes); expect(f.account("run")).toMatchObject({ settledUnits: 150, uncertainUnits: 0, activeConcurrency: 0 });
  });
  it("forced digest equality never admits conflicting final canonical bytes", async () => {
    const { f, a } = await admitted(); await f.checkpoint(a); const first = await capture(f, a, charge(f, a)), final = charge(f, a, "0.000150"); await capture(f, a, final);
    const conflicting = charge(f, a, "0.000151"), finalHash = f.attempt(a.attemptId).receiptHash!;
    const original = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
      if (new TextDecoder().decode(data as ArrayBuffer) === conflicting) return Uint8Array.from(Buffer.from(finalHash, "hex")).buffer;
      return await original(algorithm, data);
    });
    await unchanged(f, () => capture(f, a, conflicting));
    expect(await capture(f, a, charge(f, a))).toMatchObject({ evidenceId: first.evidenceId, settledCostUnits: 150 });
  });
  it("only two new registrations are internal and the ledger still has exactly five tables/eleven indexes", () => {
    for (const name of ["captureTerminalEvidence", "attachTerminalResult"] as const) {
      const registration = ledger[name] as unknown as Registration;
      expect(registration.isInternal).toBe(true); expect(registration.isPublic).not.toBe(true);
    }
    const tables = JSON.parse(schema.export()) as { tables: { tableName: string; indexes: unknown[] }[] };
    const policy = tables.tables.filter((table) => ["runtimeModelPolicies", "runtimeModelQualifications", "runtimeBudgetAccounts", "runtimeModelOperations", "runtimeModelAttempts"].includes(table.tableName));
    expect(policy).toHaveLength(5); expect(policy.reduce((sum, table) => sum + table.indexes.length, 0)).toBe(11);
  });
});

// Further terminal outcome regressions, still appended after the exact accepted 76-test prefix.
describe("terminal attachment closure and strict monetary truth", () => {
  async function prepared(cost: string | null = "0.000040") {
    const { f, a } = await admitted(); await f.checkpoint(a);
    const data = JSON.parse(f.receipt(a)) as Record<string, unknown>; delete data.privateResultCanonical;
    if (cost === null) { delete data.aggregateCostUsd; data.costSource = "unavailable"; } else data.aggregateCostUsd = cost;
    const encoded = canonicalModelJson(data);
    const args = { attemptId: a.attemptId, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical: encoded };
    const captured = await f.invoke<{ evidenceId: string; settledCostUnits?: number }>("captureTerminalEvidence", args);
    const attachArgs = { reference: f.reference, attemptId: a.attemptId, evidenceId: captured.evidenceId, privateResultCanonical: canonicalModelJson({ text: "answer" }) };
    return { f, a, data, encoded, args, captured, attachArgs };
  }
  it.each(["revoked", "cancelled", "retired", "policyNarrowed"])("pending attachment %s closes permanently before renewal with zero monetary delta", async (kind) => {
    const { f, a, captured, attachArgs } = await prepared(); const money = JSON.stringify(f.db.table("runtimeBudgetAccounts"));
    if (kind === "revoked") f.grant.revokedAt = clock;
    if (kind === "cancelled") f.db.table("runtimeModelOperations")[0]!.cancelled = true;
    if (kind === "retired") f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, resourceType: "tenant", resourceId: f.reference.tenantId, deletedAt: clock });
    if (kind === "policyNarrowed") {
      delete f.grant.memorySpaceId; delete f.grant.memorySpaceEpoch; f.grant.resourceAccess = "tenant";
      const reference = { ...f.reference }; delete reference.memorySpaceId; delete reference.memorySpaceEpoch;
      await f.invoke("provisionTenantPolicy", { reference, policyId: "attachment-limit", expectedVersion: 0,
        policyCanonical: canonicalModelJson({ policyId: "attachment-limit", version: 1, scope: "tenant", tenantId: reference.tenantId, rules: { limits: { outputTokens: 1 } } }) });
    }
    expect(await f.invoke("attachTerminalResult", attachArgs)).toEqual({ attached: false, resultWithheld: true });
    expect(f.attempt(a.attemptId).resultAttachmentState).toBe("closed");
    delete f.grant.revokedAt; f.db.table("runtimeModelOperations")[0]!.cancelled = false;
    f.db.rows.set("runtimeAuthTombstones", []);
    const writes = f.db.writes;
    expect(await f.invoke("attachTerminalResult", attachArgs)).toEqual({ attached: false, resultWithheld: true });
    expect(f.db.writes).toBe(writes); expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(money); expect(captured.settledCostUnits).toBe(40);
  });
  it("forced initial hash equality cannot replace immutable initial nonmoney facts", async () => {
    const { f, a, args, data, encoded } = await prepared(null); const initialHash = f.attempt(a.attemptId).terminalEvidenceHash!;
    const conflicting = canonicalModelJson({ ...data, receiptId: "other-terminal" });
    const original = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, bytes) => {
      if (new TextDecoder().decode(bytes as ArrayBuffer) === conflicting) return Uint8Array.from(Buffer.from(initialHash, "hex")).buffer;
      return await original(algorithm, bytes);
    });
    const before = JSON.stringify([...f.db.rows]), writes = f.db.writes;
    await expect(f.invoke("captureTerminalEvidence", { ...args, receiptCanonical: conflicting })).rejects.toThrow();
    expect(JSON.stringify([...f.db.rows])).toBe(before); expect(f.db.writes).toBe(writes); expect(f.attempt(a.attemptId).terminalEvidenceCanonical).toBe(encoded);
  });
  it("known usage additions are allowed only with complete money and absent facts never erase existing known values", async () => {
    const { f, a, args, captured } = await prepared(null);
    const initial = JSON.parse(args.receiptCanonical) as Record<string, unknown>;
    const final = canonicalModelJson({ ...initial, costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000040", actualModel: "openai/gpt-4o-mini", usage: { totalTokens: 35, inputTokens: 15, outputTokens: 20, cachedInputTokens: 0, reasoningTokens: 0 } });
    expect(await f.invoke("captureTerminalEvidence", { ...args, receiptCanonical: final })).toMatchObject({ evidenceId: captured.evidenceId, settledCostUnits: 40 });
    const writes = f.db.writes;
    await expect(f.invoke("captureTerminalEvidence", { ...args, receiptCanonical: canonicalModelJson({ ...initial, costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000040" }) })).rejects.toThrow();
    expect(f.db.writes).toBe(writes); expect(f.attempt(a.attemptId).resultAttachmentState).toBe("closed");
  });
  it("historical root without complete monetary support cannot be upgraded by producer claims", async () => {
    root = { ...root, dispatchEvidence: root.dispatchEvidence.map((proof) => ({ ...proof, terminalCost: "unavailable" as const })) };
    const f = fixture(); await f.install(); const b = await f.bind(); const a = await f.admit(b); await f.checkpoint(a);
    const data = JSON.parse(f.receipt(a)) as Record<string, unknown>; delete data.privateResultCanonical;
    const args = { attemptId: a.attemptId, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical: canonicalModelJson(data) };
    expect(await f.invoke("captureTerminalEvidence", args)).toMatchObject({ state: "uncertain", overrun: false });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, settledUnits: 0, activeConcurrency: 0 });
    const writes = f.db.writes, before = JSON.stringify([...f.db.rows]);
    await expect(f.invoke("captureTerminalEvidence", { ...args, receiptCanonical: canonicalModelJson({ ...data, aggregateCostUsd: "0.000150" }) })).rejects.toThrow();
    expect(f.db.writes).toBe(writes); expect(JSON.stringify([...f.db.rows])).toBe(before);
  });
  it("bounded but overflowing terminal money conservatively retains uncertain reserve and releases one genuine slot", async () => {
    const { f, a, captured, args } = await prepared("9007199254740992");
    expect(captured.settledCostUnits).toBeUndefined(); expect(f.attempt(a.attemptId).resultAttachmentState).toBe("closed");
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, reservedUnits: 0, activeConcurrency: 0 });
    const writes = f.db.writes; await f.invoke("captureTerminalEvidence", args); expect(f.db.writes).toBe(writes);
  });
});

describe("terminal root delivery bounds", () => {
  async function captured() {
    const { f, a } = await admitted(); await f.checkpoint(a);
    const data = JSON.parse(f.receipt(a)) as Record<string, unknown>; delete data.privateResultCanonical;
    const receiptCanonical = canonicalModelJson(data);
    const result = await f.invoke<{ evidenceId: string }>("captureTerminalEvidence", { attemptId: a.attemptId, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical });
    return { f, a, evidenceId: result.evidenceId };
  }
  it("immutable root result byte ceiling is enforced independently from the storage maximum", async () => {
    root = { ...root, dispatchEvidence: root.dispatchEvidence.map((proof) => ({ ...proof, resultBound: { ...proof.resultBound, maximumPrivateResultBytes: 16 } })) };
    const { f, a, evidenceId } = await captured(); const writes = f.db.writes;
    const args = { reference: f.reference, attemptId: a.attemptId, evidenceId, privateResultCanonical: canonicalModelJson({ text: "answer" }) };
    expect(await f.invoke("attachTerminalResult", args)).toEqual({ attached: false, resultWithheld: true });
    expect(f.db.writes).toBe(writes); expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    expect(await f.invoke("attachTerminalResult", { ...args, privateResultCanonical: canonicalModelJson({ text: "a" }) })).toEqual({ attached: true, resultWithheld: false });
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, activeConcurrency: 0 });
  });
  it("expired current qualification closes pending attachment while preserving historical incurred charge", async () => {
    const { f, a, evidenceId } = await captured(); const args = { reference: f.reference, attemptId: a.attemptId, evidenceId, privateResultCanonical: canonicalModelJson({ text: "answer" }) };
    jest.spyOn(Date, "now").mockReturnValue(root.dispatchEvidence[0]!.expiresAt);
    expect(await f.invoke("attachTerminalResult", args)).toEqual({ attached: false, resultWithheld: true });
    expect(f.attempt(a.attemptId).resultAttachmentState).toBe("closed"); expect(f.account("tenant").settledUnits).toBe(40);
    jest.spyOn(Date, "now").mockReturnValue(clock); const writes = f.db.writes;
    expect(await f.invoke("attachTerminalResult", args)).toEqual({ attached: false, resultWithheld: true }); expect(f.db.writes).toBe(writes);
  });
});

describe("terminal embedding result profile fence", () => {
  it("known embedding capture accepts only one current matching profile vector, with zero attachment charge delta", async () => {
    const originalQualification = root.qualifications[0]!, originalProof = root.dispatchEvidence[0]!;
    root = { ...root, policies: [{ ...deployment, rules: { ...deployment.rules, modelId: DEFAULT_EMBEDDING_PROFILE.modelId, nativeInterface: "embedding", capabilities: ["embedding"], interfaces: ["embedding"] } }],
      qualifications: [{ ...originalQualification, receiptId: "synthetic-embedding", modelId: DEFAULT_EMBEDDING_PROFILE.modelId, nativeInterface: "embedding", capabilities: ["embedding"] }],
      dispatchEvidence: [{ ...originalProof, receiptId: "synthetic-embedding", modelId: DEFAULT_EMBEDDING_PROFILE.modelId, nativeInterface: "embedding",
        inputBound: { ...originalProof.inputBound, ruleId: "default-embedding-utf8-v1", featureEnvelope: "default-embedding-v1" } }] };
    const f = fixture(); await f.install();
    const b = await f.invoke<Bound>("ensureBudget", { reference: f.reference, operationKey: "embedding.query", requestId: "embedding", requestCanonical: canonicalModelJson({ text: "hello" }) });
    const embeddingRequest = request(); delete embeddingRequest.messages; embeddingRequest.outputTokens = 0;
    embeddingRequest.profile = DEFAULT_EMBEDDING_PROFILE; embeddingRequest.batch = { ordinal: 0, start: 0, end: 1 };
    const a = await f.invoke<Reserved>("admit", { reference: f.reference, operationKey: "embedding.query", runBudgetId: b.runBudgetId, semanticId: "semantic", ordinal: 0, requestCanonical: canonicalModelJson(embeddingRequest) });
    await f.checkpoint(a);
    const dispatchIdentity = f.attempt(a.attemptId).dispatchIdentity;
    const receiptCanonical = canonicalModelJson({ version: 1, dispatchIdentity, receiptId: "embedding-terminal", modelId: DEFAULT_EMBEDDING_PROFILE.modelId, nativeInterface: "embedding", outcome: "confirmed", proof: "provider-terminal-v1", costSource: "gateway-aggregate-usd-v1", aggregateCostUsd: "0.000040" });
    const captured = await f.invoke<{ evidenceId: string }>("captureTerminalEvidence", { attemptId: a.attemptId, dispatchIdentity, receiptCanonical });
    const attachArgs = { reference: f.reference, attemptId: a.attemptId, evidenceId: captured.evidenceId };
    const vector = Array.from({ length: DEFAULT_EMBEDDING_PROFILE.dimensions }, () => 0.1);
    const money = JSON.stringify(f.db.table("runtimeBudgetAccounts")), writes = f.db.writes;
    for (const result of [{ profile: { ...DEFAULT_EMBEDDING_PROFILE, profileId: "wrong" }, vectors: [vector] }, { profile: DEFAULT_EMBEDDING_PROFILE, vectors: [vector, vector] }, { profile: DEFAULT_EMBEDDING_PROFILE, vectors: [[0.1]] }]) {
      expect(await f.invoke("attachTerminalResult", { ...attachArgs, privateResultCanonical: canonicalModelJson(result) })).toEqual({ attached: false, resultWithheld: true });
      expect(f.db.writes).toBe(writes);
    }
    const privateResultCanonical = canonicalModelJson({ profile: DEFAULT_EMBEDDING_PROFILE, vectors: [vector] });
    expect(await f.invoke("attachTerminalResult", { ...attachArgs, privateResultCanonical })).toEqual({ attached: true, resultWithheld: false });
    expect(f.attempt(a.attemptId)).toMatchObject({ resultAttachmentState: "attached", privateResultCanonical });
    expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(money);
  });
});

/** C2 repair: inability to read eligibility is retryable persistence failure, not positive revocation. */
describe("terminal eligibility unexpected errors preserve exact persistence retry", () => {
  async function prepared(captureFirst = true) {
    const { f, a } = await admitted(); await f.checkpoint(a);
    const receipt = JSON.parse(f.receipt(a)) as Record<string, unknown>; delete receipt.privateResultCanonical;
    const captureArgs = { attemptId: a.attemptId, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical: canonicalModelJson(receipt) };
    const result = captureFirst ? await f.invoke<{ evidenceId: string }>("captureTerminalEvidence", captureArgs) : undefined;
    const attachArgs = { reference: f.reference, attemptId: a.attemptId, evidenceId: result?.evidenceId ?? "not-yet-captured", privateResultCanonical: canonicalModelJson({ text: "answer" }) };
    return { f, a, captureArgs, attachArgs };
  }
  function inject(f: ReturnType<typeof fixture>, error: unknown) {
    const query = f.db.query.bind(f.db);
    return jest.spyOn(f.db, "query").mockImplementation((table: string) => { if (table === "runtimeModelPolicies") throw error; return query(table); });
  }
  async function identicalFailure(f: ReturnType<typeof fixture>, error: unknown, run: () => Promise<unknown>) {
    const before = JSON.stringify([...f.db.rows]), writes = f.db.writes;
    await expect(run()).rejects.toBe(error); expect(JSON.stringify([...f.db.rows])).toBe(before); expect(f.db.writes).toBe(writes);
  }
  it("faulted pending attachment preserves all rows and original error/cause; exact retry attaches once after read recovery", async () => {
    const { f, a, attachArgs } = await prepared(); const cause = new Error("synthetic cause"), error = new Error("synthetic transient database read failure", { cause });
    const spy = inject(f, error); await identicalFailure(f, error, () => f.invoke("attachTerminalResult", attachArgs));
    expect(error.cause).toBe(cause); expect(f.attempt(a.attemptId).resultAttachmentState).toBe("pending");
    spy.mockRestore(); const money = JSON.stringify(f.db.table("runtimeBudgetAccounts"));
    expect(await f.invoke("attachTerminalResult", attachArgs)).toEqual({ attached: true, resultWithheld: false });
    const writes = f.db.writes; expect(await f.invoke("attachTerminalResult", attachArgs)).toEqual({ attached: true, resultWithheld: false });
    expect(f.db.writes).toBe(writes); expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(money);
    expect(f.attempt(a.attemptId)).toMatchObject({ resultAttachmentState: "attached", privateResultCanonical: attachArgs.privateResultCanonical });
  });
  it("faulted first known capture has zero writes/charge/marker/closure; same receipt retry settles full cost once pending", async () => {
    const { f, a, captureArgs } = await prepared(false); const error = new Error("synthetic eligibility read fault");
    const spy = inject(f, error); await identicalFailure(f, error, () => f.invoke("captureTerminalEvidence", captureArgs));
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 100, settledUnits: 0, uncertainUnits: 0, activeConcurrency: 1 });
    expect(f.attempt(a.attemptId)).toMatchObject({ state: "dispatch_pending", slotReleased: false });
    expect(f.attempt(a.attemptId).terminalEvidenceHash).toBeUndefined(); expect(f.attempt(a.attemptId).resultAttachmentState).toBeUndefined();
    spy.mockRestore(); const captured = await f.invoke("captureTerminalEvidence", captureArgs);
    expect(captured).toMatchObject({ state: "settled", settledCostUnits: 40, overrun: false });
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 0, settledUnits: 40, uncertainUnits: 0, activeConcurrency: 0 });
    expect(f.attempt(a.attemptId).resultAttachmentState).toBe("pending"); const writes = f.db.writes;
    expect(await f.invoke("captureTerminalEvidence", captureArgs)).toEqual(captured); expect(f.db.writes).toBe(writes);
  });
  it.each(["domainMessage", "structuredLookingPlainObject", "unknownConvexCode", "malformedConvexData", "dataAccessor", "codeAccessor", "messageAccessor", "inspectionFailure"])("unexpected %s propagates exact identity without getter calls or state change", async (kind) => {
    const { ConvexError } = await import("convex/values"); const { f, a, attachArgs } = await prepared(); let getterCalls = 0;
    const structured = { version: 1, code: "FORBIDDEN", message: "Access denied", retryable: false, outcome: "not_dispatched" };
    let error: unknown;
    if (kind === "domainMessage") error = new Error("POLICY_DENIED: unexpected runtime failure");
    if (kind === "structuredLookingPlainObject") error = { data: structured };
    if (kind === "unknownConvexCode") error = new ConvexError({ ...structured, code: "UNEXPECTED_STORAGE_FAILURE" });
    if (kind === "malformedConvexData") error = new ConvexError({ ...structured, retryable: true });
    if (kind === "dataAccessor") error = Object.defineProperty(new ConvexError(structured), "data", { get: () => { getterCalls++; return structured; } });
    if (kind === "codeAccessor") {
      const native = new ConvexError(structured);
      Object.defineProperty(native.data, "code", { get: () => { getterCalls++; return "FORBIDDEN"; } }); error = native;
    }
    if (kind === "messageAccessor") error = Object.defineProperty(new Error(), "message", { get: () => { getterCalls++; return "POLICY_DENIED: forged"; } });
    if (kind === "inspectionFailure") error = new Proxy(new Error("original unexpected runtime failure"), { getPrototypeOf: () => { throw new Error("inspection also failed"); } });
    const spy = inject(f, error); await identicalFailure(f, error, () => f.invoke("attachTerminalResult", attachArgs));
    expect(getterCalls).toBe(0); expect(f.attempt(a.attemptId).resultAttachmentState).toBe("pending"); spy.mockRestore();
    expect(await f.invoke("attachTerminalResult", attachArgs)).toEqual({ attached: true, resultWithheld: false });
  });
  it("recognized native policy denial closes pending and preserves monetary accounts without message matching", async () => {
    const { ConvexError } = await import("convex/values"); const { f, a, attachArgs } = await prepared();
    const error = new ConvexError({ version: 1, code: "POLICY_DENIED", message: "structured control denial", retryable: false, outcome: "uncertain" });
    const money = JSON.stringify(f.db.table("runtimeBudgetAccounts")), spy = inject(f, error);
    expect(await f.invoke("attachTerminalResult", attachArgs)).toEqual({ attached: false, resultWithheld: true });
    expect(f.attempt(a.attemptId).resultAttachmentState).toBe("closed"); spy.mockRestore(); const writes = f.db.writes;
    expect(await f.invoke("attachTerminalResult", attachArgs)).toEqual({ attached: false, resultWithheld: true });
    expect(f.db.writes).toBe(writes); expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(money);
  });
});


/** A synthetic current Agent fence denial cannot discard already-observed charges. */
describe("Agent budget admission versus charge-only terminal capture", () => {
  it("refuses current Agent admission and visibility, but accounts terminal evidence exactly once", async () => {
    const { f, b, a } = await admitted(); await f.checkpoint(a);
    f.db.seed("runtimeRuns", { runAccountId: b.runAccountId, executionRequested: true, tenantId: f.reference.tenantId,
      memorySpaceId: f.reference.memorySpaceId, runId: "closed-agent-run", attemptNumber: 1, authorityReference: f.reference });
    const before = f.db.writes;
    await expect(f.invoke("resolve", { reference: f.reference, operationKey: "agent.respond", runBudgetId: b.runBudgetId })).rejects.toThrow("INVALID_STATE");
    await expect(f.invoke("markVisible", { reference: f.reference, attemptId: a.attemptId, outputVisible: true,
      toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false })).rejects.toThrow("INVALID_STATE");
    expect(f.db.writes).toBe(before);
    const charge = JSON.parse(f.receipt(a)) as Record<string, unknown>; delete charge.privateResultCanonical;
    const args = { attemptId: a.attemptId, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical: canonicalModelJson(charge) };
    const capture = await f.invoke<{ evidenceId: string; settledCostUnits: number }>("captureTerminalEvidence", args);
    expect(capture.settledCostUnits).toBe(40); expect(f.attempt(a.attemptId)).toMatchObject({ state: "settled", resultAttachmentState: "closed", slotReleased: true });
    expect(f.account("run")).toMatchObject({ activeConcurrency: 0, settledUnits: 40, reservedUnits: 0 });
    expect(f.account("tenant")).toMatchObject({ activeConcurrency: 0, settledUnits: 40, reservedUnits: 0 });
    expect(await f.invoke("attachTerminalResult", { reference: f.reference, attemptId: a.attemptId, evidenceId: capture.evidenceId,
      privateResultCanonical: canonicalModelJson({ text: "withheld" }) })).toEqual({ attached: false, resultWithheld: true });
    const settledWrites = f.db.writes; expect(await f.invoke("captureTerminalEvidence", args)).toEqual(capture); expect(f.db.writes).toBe(settledWrites);
  });
});

/** Both stored encodings must normalize to the same original compiled provenance. */
describe("compact compiled root provenance — actual original ledger handlers", () => {
  type Encoding = "full" | "compact";
  async function fullRoot() {
    const canonical = canonicalModelJson(root);
    return { manifestId: root.manifestId, revision: root.revision, canonical, hash: await semanticHash(canonical),
      artifactRevision: root.artifactRevision, evidenceHash: root.evidenceHash, acceptanceHash: root.acceptanceHash };
  }
  async function representation(f: ReturnType<typeof fixture>, encoding: Encoding) {
    const full = await fullRoot(), { canonical: _canonical, ...fields } = full;
    const value = encoding === "full" ? full : { encoding: "compiled-root-v1", ...fields };
    for (const table of ["runtimeModelPolicies", "runtimeModelQualifications", "runtimeBudgetAccounts"])
      for (const row of f.db.table(table)) row.root = JSON.parse(JSON.stringify(value));
    return value;
  }
  async function installed(encoding: Encoding) { const f = fixture(); await f.install(); await representation(f, encoding); return f; }
  function money(f: ReturnType<typeof fixture>) {
    return f.db.table("runtimeBudgetAccounts").map(({ root: _root, ...row }) => row);
  }
  async function noEffects(f: ReturnType<typeof fixture>, action: () => Promise<unknown>) {
    const snapshot = () => canonicalModelJson({ rows: [...f.db.rows].filter(([, rows]) => rows.length), writes: f.db.writes });
    const before = snapshot(); await expect(action()).rejects.toThrow(); expect(snapshot()).toBe(before);
  }
  it("fresh install stores the exact compact provenance, lowers repeated bytes, and retains canonical controls and bounded indexes", async () => {
    const f = fixture(); await f.install(); const full = await fullRoot();
    const roots = [...f.db.table("runtimeModelPolicies"), ...f.db.table("runtimeModelQualifications")].map(row => row.root as Record<string, unknown>);
    expect(roots).toHaveLength(2); expect(roots.every(value => value.encoding === "compiled-root-v1" && !Object.hasOwn(value, "canonical"))).toBe(true);
    expect(roots[0]).toEqual({ encoding: "compiled-root-v1", manifestId: full.manifestId, revision: full.revision, hash: full.hash,
      artifactRevision: full.artifactRevision, evidenceHash: full.evidenceHash, acceptanceHash: full.acceptanceHash });
    expect(new TextEncoder().encode(canonicalModelJson(roots[0])).length).toBeLessThan(new TextEncoder().encode(canonicalModelJson(full)).length);
    expect(f.db.table("runtimeModelPolicies")[0].canonical).toBe(canonicalModelJson(root.policies[0]));
    expect(f.db.table("runtimeModelQualifications")[0].canonical).toBe(canonicalModelJson(root.qualifications[0]));
    const binding = await f.bind(); expect(f.account("run").root).toEqual(roots[0]); expect(f.account("tenant").root).toEqual(roots[0]);
    expect(binding).toEqual(await f.bind()); expect(f.db.table("runtimeBudgetAccounts")).toHaveLength(2);
  });
  it("legacy full same-revision reinstall retains every original root byte, account window and liability", async () => {
    const f = await installed("full"), binding = await f.bind(), admitted = await f.admit(binding); await f.checkpoint(admitted);
    await f.invoke("recover", { reference: f.reference, attemptId: admitted.attemptId });
    const before = canonicalModelJson({ rows: [...f.db.rows], writes: f.db.writes }); await f.install();
    expect(canonicalModelJson({ rows: [...f.db.rows], writes: f.db.writes })).toBe(before);
    const next = await f.bind("next-original-window"); expect(next.runBudgetId).not.toBe(binding.runBudgetId);
    expect(f.db.table("runtimeBudgetAccounts").filter(row => row.kind === "tenant")).toHaveLength(1);
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, activeConcurrency: 1 });
    expect(Object.hasOwn(f.account("run").root, "canonical")).toBe(true);
  });
  it("full and compact handlers have identical resolve/admit/permit/visibility/settlement/replay outputs and counters", async () => {
    const outcomes = [];
    for (const encoding of ["full", "compact"] as const) {
      const f = await installed(encoding), binding = await f.bind();
      const resolution = await f.invoke("resolve", { reference: f.reference, operationKey: "agent.respond", runBudgetId: binding.runBudgetId });
      const admitted = await f.admit(binding), permit = await f.checkpoint(admitted);
      const duplicatePermit = await f.checkpoint(admitted);
      const visible = await f.invoke("markVisible", { reference: f.reference, attemptId: admitted.attemptId,
        outputVisible: true, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false });
      const settled = await f.settle(admitted), replay = await f.admit(binding); const before = f.db.writes; await f.settle(admitted); expect(f.db.writes).toBe(before);
      expect(f.account("tenant")).toMatchObject({ settledUnits: 40, uncertainUnits: 0, reservedUnits: 0, activeConcurrency: 0 });
      expect(f.db.table("runtimeModelOperations")).toHaveLength(1); expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
      outcomes.push({ binding, resolution, admitted, permit, duplicatePermit, visible, settled, replay, money: money(f), attempts: f.db.table("runtimeModelAttempts") });
    }
    expect(outcomes[0]).toEqual(outcomes[1]);
  });
  it.each(["full", "compact"] as const)("%s preserves UNKNOWN liability, released terminal slots, cancellation and forbidden fallback", async encoding => {
    const f = await installed(encoding), binding = await f.bind(), a = await f.admit(binding); await f.checkpoint(a);
    const receipt = JSON.parse(f.receipt(a)) as Record<string, unknown>; delete receipt.aggregateCostUsd; receipt.costSource = "unavailable";
    await f.invoke("settle", { reference: f.reference, attemptId: a.attemptId, receiptCanonical: canonicalModelJson(receipt) });
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, reservedUnits: 0, activeConcurrency: 0 });
    expect(await f.admit(binding)).toMatchObject({ status: "uncertain", replayAllowed: false });
    const oldMoney = canonicalModelJson(money(f)); await f.install(); expect(canonicalModelJson(money(f))).toBe(oldMoney);
    await f.invoke("cancelBudget", { reference: f.reference, runBudgetId: binding.runBudgetId });
    await noEffects(f, () => f.admit(binding, 1));
    await noEffects(f, () => f.invoke("checkFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "unqualified/model" }));
    expect(f.db.table("runtimeModelAttempts")).toHaveLength(1);
  });
  it("mixed exact roots use explicit compiled equality without retiring/resetting the financial window", async () => {
    const f = await installed("full"); const full = await fullRoot(), { canonical: _canonical, ...fields } = full;
    const compact = { encoding: "compiled-root-v1" as const, ...fields };
    f.db.table("runtimeModelQualifications")[0].root = compact;
    const first = await f.bind(), a = await f.admit(first); await f.checkpoint(a); await f.invoke("recover", { reference: f.reference, attemptId: a.attemptId });
    f.account("tenant").root = compact; const original = canonicalModelJson(f.account("tenant"));
    const second = await f.bind("mixed-representations"); expect(second.runBudgetId).not.toBe(first.runBudgetId);
    expect(canonicalModelJson(f.account("tenant"))).toBe(original); expect(f.db.table("runtimeBudgetAccounts").filter(row => row.kind === "tenant")).toHaveLength(1);
    expect(f.account("tenant")).toMatchObject({ uncertainUnits: 100, activeConcurrency: 1 });
    await f.install(); expect(f.db.table("runtimeModelPolicies")[0].root).toEqual(full); expect(f.db.table("runtimeModelQualifications")[0].root).toEqual(compact);
  });
  it.each(["encoding", "extra", "canonical", "hash", "artifactRevision", "evidenceHash", "acceptanceHash", "manifestId", "revision"])(
    "compact %s inconsistency is refused before new model effects", async field => {
      const f = await installed("compact"), b = await f.bind(); const stored = f.db.table("runtimeModelPolicies")[0].root as Record<string, unknown>;
      if (field === "encoding") stored.encoding = "compiled-root-v2";
      else if (field === "extra") stored.callerProof = "untrusted";
      else if (field === "canonical") stored.canonical = canonicalModelJson(root);
      else if (field === "revision") stored.revision = 2;
      else stored[field] = "mismatched";
      await noEffects(f, () => f.admit(b)); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    });
  it.each(["full", "compact"] as const)("%s unchanged visibility still denies current revocation and expired selected evidence", async encoding => {
    const f = await installed(encoding), b = await f.bind(), a = await f.admit(b); await f.checkpoint(a);
    const flags = { reference: f.reference, attemptId: a.attemptId, outputVisible: true, toolInputVisible: false, toolResultVisible: false, toolEffectCommitted: false };
    await f.invoke("markVisible", flags); f.grant.revokedAt = clock; await noEffects(f, () => f.invoke("markVisible", flags));
    delete f.grant.revokedAt; jest.spyOn(Date, "now").mockReturnValue(root.dispatchEvidence[0]!.expiresAt);
    await noEffects(f, () => f.invoke("markVisible", flags)); expect(f.attempt(a.attemptId).outputVisible).toBe(true);
  });
  it.each(["qualification-root", "qualification-canonical", "qualification-revoked", "qualification-inactive", "qualification-duplicate", "policy-canonical", "policy-revoked", "policy-duplicate"])(
    "fresh indexed reads preserve the original %s denial", async fault => {
      const f = await installed("compact"), b = await f.bind(), q = f.db.table("runtimeModelQualifications")[0], p = f.db.table("runtimeModelPolicies")[0];
      if (fault === "qualification-root") (q.root as Record<string, unknown>).hash = "b".repeat(64);
      if (fault === "qualification-canonical") q.canonical = "{}";
      if (fault === "qualification-revoked") q.revokedAt = clock;
      if (fault === "qualification-inactive") q.active = false;
      if (fault === "qualification-duplicate") f.db.seed("runtimeModelQualifications", { ...q, _id: "runtimeModelQualifications:duplicate" });
      if (fault === "policy-canonical") p.canonical = "{}";
      if (fault === "policy-revoked") p.revokedAt = clock;
      if (fault === "policy-duplicate") f.db.seed("runtimeModelPolicies", { ...p, _id: "runtimeModelPolicies:duplicate" });
      await noEffects(f, () => f.admit(b)); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    });
  it.each(["full", "compact"] as const)("%s account corruption fails the original permit proof without refunding reservation", async encoding => {
    const f = await installed(encoding), b = await f.bind(), a = await f.admit(b); (f.account("run").root as Record<string, unknown>).hash = "b".repeat(64);
    await noEffects(f, () => f.checkpoint(a)); expect(f.attempt(a.attemptId).checkpointAt).toBeUndefined();
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 100, activeConcurrency: 1 });
  });
  it.each(["policy-write", "qualification-write"])("partial compact %s rolls back on the actual install storage fault port", async fault => {
    const f = fixture(), before = JSON.parse(JSON.stringify([...f.db.rows])) as [string, ReturnType<typeof f.db.table>][];
    const writes = f.db.writes, sequence = f.db.sequence, insert = f.db.insert.bind(f.db); let reached = false;
    f.db.insert = async (table, value) => { const id = await insert(table, value); if (table === (fault === "policy-write" ? "runtimeModelPolicies" : "runtimeModelQualifications")) { reached = true; throw new Error("CONTROLLED_INSTALL_STORAGE_FAILURE"); } return id; };
    const transaction = async () => { try { await f.install(); } catch (error) { f.db.rows = new Map(before); f.db.writes = writes; f.db.sequence = sequence; throw error; } };
    await expect(transaction()).rejects.toThrow("CONTROLLED_INSTALL_STORAGE_FAILURE"); expect(reached).toBe(true);
    expect([...f.db.rows]).toEqual(before); expect(f.db.writes).toBe(writes); expect(f.db.table("runtimeBudgetAccounts")).toEqual([]);
  });
  it.each(["full", "compact"] as const)("%s secondary children retain exact parent account and cancellation fences", async encoding => {
    const f = await installed(encoding), b = await f.bind(), parent = await f.admit(b), foreign = await f.bind("foreign-parent-account");
    const child = await f.invoke<Reserved>("admit", { reference: f.reference, operationKey: "artifact.text", runBudgetId: b.runBudgetId, semanticId: "compact-secondary", ordinal: 0,
      requestCanonical: canonicalModelJson(request()), parentOperationId: parent.operationId });
    expect(await f.checkpoint(child)).toMatchObject({ dispatchPermit: true });
    const owned = f.db.table("runtimeModelOperations").find(row => row._id === parent.operationId)!; owned.cancelled = true;
    await noEffects(f, () => f.checkpoint(child));
    await noEffects(f, () => f.admit(foreign, 0, "hello", { semanticId: "foreign-child", parentOperationId: parent.operationId }));
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 200, activeConcurrency: 2 }); expect(f.db.table("runtimeModelAttempts")).toHaveLength(2);
  });
  it("legacy canonical/control metadata mismatches cannot be normalized as valid compact provenance", async () => {
    for (const field of ["canonical", "hash", "artifactRevision", "evidenceHash", "acceptanceHash", "extra"] as const) {
      const f = await installed("full"), b = await f.bind(), stored = f.db.table("runtimeModelPolicies")[0].root as Record<string, unknown>;
      stored[field] = field === "canonical" ? "{}" : "mismatch";
      await noEffects(f, () => f.admit(b)); expect(f.db.table("runtimeModelAttempts")).toEqual([]);
    }
  });
  it("the actual Convex schema serializer retains legacy object plus exact compact union with unchanged ledger indexes", async () => {
    const serialized = JSON.parse(schema.export()) as { tables: { tableName: string; documentType: { value: Record<string, { fieldType: unknown }> }; indexes: unknown[] }[] };
    const nativeRoot = (await import("../../../convex-dev/runtimePolicySchema")).rootProvenance;
    // Convex strips this implemented @internal getter from declarations.
    const rootJson = (nativeRoot as unknown as { json: unknown }).json;
    expect(rootJson).toMatchObject({ type: "union", value: [{ type: "object", value: { canonical: { fieldType: { type: "string" } } } },
      { type: "object", value: { encoding: { fieldType: { type: "literal", value: "compiled-root-v1" } } } }] });
    for (const table of serialized.tables.filter(table => ["runtimeModelPolicies", "runtimeModelQualifications", "runtimeBudgetAccounts"].includes(table.tableName)))
      expect(table.documentType.value.root.fieldType).toEqual(rootJson);
    expect(serialized.tables.filter(table => ["runtimeModelPolicies", "runtimeModelQualifications", "runtimeBudgetAccounts", "runtimeModelOperations", "runtimeModelAttempts"].includes(table.tableName)))
      .toHaveLength(5);
    // Serialization and handler denials are observed; this is not a native backend value-validation execution.
  });
});
it("compact root loops hash compiled provenance once per install/active-root invocation, never once per qualification row", async () => {
  const unused = Array.from({ length: 24 }, (_, index) => ({ ...root.qualifications[0]!, receiptId: `unused:${index}`, modelId: `fixture/unused-${index}` }));
  root = { ...root, qualifications: [...root.qualifications, ...unused], dispatchEvidence: [...root.dispatchEvidence,
    ...unused.map(qualification => ({ ...root.dispatchEvidence[0]!, receiptId: qualification.receiptId, modelId: qualification.modelId }))] };
  const f = fixture(), encoded = canonicalModelJson(root), digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle); let hashes = 0;
  jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => {
    if (new TextDecoder().decode(data as ArrayBuffer) === encoded) hashes++; return await digest(algorithm, data);
  });
  await f.install(); expect(f.db.table("runtimeModelQualifications")).toHaveLength(25); expect(hashes).toBe(1);
  hashes = 0; const writes = f.db.writes; await f.install(); expect(hashes).toBe(1); expect(f.db.writes).toBe(writes);
  const b = await f.bind(); hashes = 0;
  expect(await f.invoke("resolve", { reference: f.reference, operationKey: "agent.respond", runBudgetId: b.runBudgetId })).toMatchObject({ snapshot: { limits: { outputTokens: 500 } } });
  expect(hashes).toBe(1);
});

describe("unreserved native capacity classifications", () => {
  it.each(["concurrency", "money", "window", "account"] as const)("classifies %s only before a new reservation and preserves the old code/caps", async reason => {
    const f = fixture(); await f.install(); const b = await f.bind();
    const tenant = f.account("tenant");
    if (reason === "concurrency") await f.db.patch("runtimeBudgetAccounts", tenant._id, { activeConcurrency: tenant.concurrencyLimit });
    if (reason === "money") await f.db.patch("runtimeBudgetAccounts", tenant._id, { settledUnits: tenant.limitUnits });
    if (reason === "window") await f.db.patch("runtimeBudgetAccounts", tenant._id, { windowEnd: clock });
    if (reason === "account") await f.db.patch("runtimeBudgetAccounts", tenant._id, { overrun: true });
    const before = canonicalModelJson(f.db.table("runtimeBudgetAccounts"));
    await expect(f.admit(b)).rejects.toMatchObject({ data: { code: "BUDGET_EXCEEDED", outcome: "not_dispatched", retryable: false,
      capacity: { version: 1, origin: "unreserved-admission", reason, operationKey: "agent.respond", runBudgetId: b.runBudgetId, semanticId: "semantic", ordinal: 0 } } });
    expect(canonicalModelJson(f.db.table("runtimeBudgetAccounts"))).toBe(before);
    expect(f.db.table("runtimeModelOperations")).toHaveLength(0); expect(f.db.table("runtimeModelAttempts")).toHaveLength(0);
  });
  it("an already held checkpoint refusal carries no unreserved-capacity proof", async () => {
    const { f, a } = await admitted(); const tenant = f.account("tenant");
    await f.db.patch("runtimeBudgetAccounts", tenant._id, { settledUnits: tenant.limitUnits });
    let error: unknown; try { await f.checkpoint(a); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ data: { code: "BUDGET_EXCEEDED" } });
    expect((error as { data: Record<string, unknown> }).data).not.toHaveProperty("capacity");
    expect(f.attempt(a.attemptId).state).toBe("reserved"); expect(f.account("run").activeConcurrency).toBe(1);
  });
});
