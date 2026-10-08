/** Offline native-handler fixtures. This fake database does NOT prove Convex OCC/isolation/rollback. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { MutationCtx } from "../../../convex-dev/_generated/server";
import type { Doc, Id } from "../../../convex-dev/_generated/dataModel";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "../../../convex-dev/runtimeModelPolicyBootstrap";
import type { ModelCallRequest, TrustedModelPolicyRecord } from "../../../src/domain/model-policy";
import { canonicalModelJson } from "../../../src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "../../../src/domain/profile";
import { memoryFixture } from "../runtimeMemory/fixture";

const lookup = jest.fn<(id: string, revision: number) => DeploymentPolicyManifest | undefined>();
jest.unstable_mockModule("../../../convex-dev/runtimeModelPolicyBootstrap", () => ({ lookupDeploymentManifest: lookup, isTrustedDeploymentManifest: (entry: DeploymentPolicyManifest) => entry === root && entry.classification === "fixture-synthetic" }));
const ledger = await import("../../../convex-dev/runtimeModelPolicy");
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

/** New charge-only outcomes. Every trust root/amount is synthetic; no provider money/OCC claim. */
type Capture = { evidenceId: string; state: string; settledCostUnits?: number; overrun: boolean };
function charge(f: ReturnType<typeof fixture>, a: Reserved, cost: string | null = "0.000040", extra: Record<string, unknown> = {}) {
  const value = JSON.parse(f.receipt(a)) as Record<string, unknown>; delete value.privateResultCanonical;
  if (cost === null) { delete value.aggregateCostUsd; value.costSource = "unavailable"; } else value.aggregateCostUsd = cost;
  return canonicalModelJson({ ...value, ...extra });
}
async function capture(f: ReturnType<typeof fixture>, a: Reserved, receiptCanonical: string) {
  return await f.invoke<Capture>("captureTerminalEvidence", { attemptId: a.attemptId, dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical });
}
async function attach(f: ReturnType<typeof fixture>, a: Reserved, evidenceId: string) {
  return await f.invoke("attachTerminalResult", { reference: f.reference, attemptId: a.attemptId, evidenceId, privateResultCanonical: canonicalModelJson({ text: "answer" }) });
}
const rows = (f: ReturnType<typeof fixture>) => JSON.stringify([...f.db.rows]);
async function denied(f: ReturnType<typeof fixture>, run: () => Promise<unknown>) {
  const before = rows(f), writes = f.db.writes;
  await expect(run()).rejects.toThrow(); expect(rows(f)).toBe(before); expect(f.db.writes).toBe(writes);
}
function guarded(f: ReturnType<typeof fixture>, a: Reserved, cost: number, unknown = 0) {
  for (const kind of ["tenant", "run"]) expect(f.account(kind)).toMatchObject({ reservedUnits: 0, settledUnits: cost, uncertainUnits: unknown, activeConcurrency: 0, overrun: true });
  expect(f.db.table("runtimeModelOperations").find((row) => row._id === a.operationId)).toMatchObject({ reservedUnits: 0, settledUnits: cost, uncertainUnits: unknown, overrun: true });
  expect(f.attempt(a.attemptId)).toMatchObject({ slotReleased: true, resultWithheld: true, resultAttachmentState: "closed" });
  expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
}
async function prepared() { const value = await admitted(); await value.f.checkpoint(value.a); return value; }
function retired(f: ReturnType<typeof fixture>) { f.db.seed("runtimeAuthTombstones", { tenantId: f.reference.tenantId, resourceType: "tenant", resourceId: f.reference.tenantId, deletedAt: clock }); }
function fallbackRoot() {
  const q = root.qualifications[0]!, proof = root.dispatchEvidence[0]!;
  root = { ...root, policies: [{ ...deployment, rules: { ...deployment.rules, allowedModels: [...deployment.rules.allowedModels!, "fixture/fallback"], fallbackModels: ["fixture/fallback"] } }],
    qualifications: [...root.qualifications, { ...q, receiptId: "synthetic-fallback", modelId: "fixture/fallback", costBound: { ...q.costBound, maximumCostUnits: 80 } }],
    dispatchEvidence: [...root.dispatchEvidence, { ...proof, receiptId: "synthetic-fallback", modelId: "fixture/fallback" }] };
}

describe("truthful first model drift is charge only", () => {
  it.each([["0.000040", 40], ["0.000150", 150]] as const)("charges full synthetic %s independently of selected identity and closes output", async (usd, units) => {
    const { f, a, b } = await prepared(); const initial = charge(f, a, usd, { actualModel: "foreign/model" });
    const accounts = [f.account("tenant")._id, f.account("run")._id], windows = [f.account("tenant").windowId, f.account("run").windowId];
    const result = await capture(f, a, initial); expect(result).toMatchObject({ state: "settled", settledCostUnits: units, overrun: true }); guarded(f, a, units);
    expect(f.attempt(a.attemptId)).toMatchObject({ actualModel: "foreign/model", terminalEvidenceCanonical: initial, receiptCanonical: initial });
    expect(JSON.parse(f.attempt(a.attemptId).snapshotCanonical)).toMatchObject({ modelId: "openai/gpt-4o-mini" });
    expect([f.account("tenant")._id, f.account("run")._id]).toEqual(accounts); expect([f.account("tenant").windowId, f.account("run").windowId]).toEqual(windows);
    const writes = f.db.writes; expect(await capture(f, a, initial)).toEqual(result); expect(await attach(f, a, result.evidenceId)).toEqual({ attached: false, resultWithheld: true }); expect(f.db.writes).toBe(writes);
    await denied(f, () => f.admit(b)); await denied(f, () => f.admit(b, 1));
  });
  it.each(["model", "input", "output"])("unknown %s violation latches without money, then full refinement never clears it", async (kind) => {
    const { f, a } = await prepared(); const observation = kind === "model" ? { actualModel: "foreign/model" } : { usage: kind === "input" ? { inputTokens: 16 } : { outputTokens: 21 } };
    const initial = charge(f, a, null, observation), first = await capture(f, a, initial), hash = f.attempt(a.attemptId).terminalEvidenceHash;
    expect(first).toMatchObject({ state: "uncertain", overrun: true }); guarded(f, a, 0, 100);
    const writes = f.db.writes; expect(await capture(f, a, initial)).toEqual(first); expect(f.db.writes).toBe(writes);
    const final = charge(f, a, "0.000040", observation); const last = await capture(f, a, final); guarded(f, a, 40);
    expect(last).toMatchObject({ evidenceId: first.evidenceId, settledCostUnits: 40, overrun: true }); expect(f.attempt(a.attemptId)).toMatchObject({ terminalEvidenceCanonical: initial, terminalEvidenceHash: hash, receiptCanonical: final });
    const post = f.db.writes; expect(await capture(f, a, initial)).toEqual(last); expect(await capture(f, a, final)).toEqual(last); expect(f.db.writes).toBe(post);
  });
  it.each(["model", "input", "output"])("absent %s fact introduced by known refinement closes/latches shared accounting", async (kind) => {
    const { f, a, b } = await prepared(); const first = await capture(f, a, charge(f, a, null));
    expect(f.account("tenant").overrun).toBe(false);
    const extra = kind === "model" ? { actualModel: "foreign/model" } : { usage: kind === "input" ? { inputTokens: 16 } : { outputTokens: 21 } };
    const final = charge(f, a, "0.000040", extra); await capture(f, a, final); guarded(f, a, 40);
    expect(await attach(f, a, first.evidenceId)).toEqual({ attached: false, resultWithheld: true }); await denied(f, () => f.admit(b, 1));
  });
  it("unsupported aggregate source retains all U even with truthful claimed150 and drift", async () => {
    root = { ...root, dispatchEvidence: root.dispatchEvidence.map((proof) => ({ ...proof, terminalCost: "unavailable" as const })) };
    const { f, a } = await prepared(); const result = await capture(f, a, charge(f, a, "0.000150", { actualModel: "foreign/model" }));
    expect(result).toMatchObject({ state: "uncertain", overrun: true }); expect(result.settledCostUnits).toBeUndefined(); guarded(f, a, 0, 100);
  });
  it("missing genuine lifetime cannot release the slot or manufacture money", async () => {
    const { f, a } = await prepared(); await denied(f, () => capture(f, a, charge(f, a, "0.000150", { actualModel: "foreign/model", proof: "claimed" })));
    await f.invoke("recover", { reference: f.reference, attemptId: a.attemptId });
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 0, uncertainUnits: 100, settledUnits: 0, activeConcurrency: 1 }); expect(f.attempt(a.attemptId)).toMatchObject({ state: "uncertain", slotReleased: false });
  });
  it.each(["revoked", "cancelled", "retired", "lateWindow"])("late full refinement after %s charges only original accounts and never reopens", async (kind) => {
    const { f, a } = await prepared(); const initial = charge(f, a, null, { actualModel: "foreign/model" }), first = await capture(f, a, initial);
    const originals = [f.account("tenant")._id, f.account("run")._id], window = f.account("tenant").windowId;
    if (kind === "revoked") f.grant.revokedAt = clock;
    if (kind === "cancelled") await f.invoke("cancelBudget", { reference: f.reference, runBudgetId: f.account("run").runBudgetId });
    if (kind === "retired") retired(f);
    jest.spyOn(Date, "now").mockReturnValue(f.account("tenant").windowEnd + 1);
    const successor = f.db.seed("runtimeBudgetAccounts", { ...f.account("tenant"), _id: "runtimeBudgetAccounts:successor", current: false, windowId: "successor", reservedUnits: 0, uncertainUnits: 0, settledUnits: 7, overrun: false }); const before = JSON.stringify(successor);
    await capture(f, a, charge(f, a, "0.000150", { actualModel: "foreign/model" })); guarded(f, a, 150);
    expect([f.account("tenant")._id, f.account("run")._id]).toEqual(originals); expect(f.account("tenant").windowId).toBe(window); expect(JSON.stringify(successor)).toBe(before);
    delete f.grant.revokedAt; f.account("run").cancelled = false; f.db.rows.set("runtimeAuthTombstones", []);
    expect(await attach(f, a, first.evidenceId)).toEqual({ attached: false, resultWithheld: true }); await denied(f, () => f.bind("laundered-new-run"));
  });
  it("original guarded successors, child and confirmed rejection fallback cannot launder model drift", async () => {
    fallbackRoot(); const { f, a, b } = await prepared(); const waiting = await f.admit(b, 1, "second");
    await capture(f, a, charge(f, a, "0.000040", { actualModel: "foreign/model", outcome: "confirmed_rejected" }));
    await denied(f, () => f.checkpoint(waiting)); await denied(f, () => f.admit(b, 2));
    await denied(f, () => f.admit(b, 0, "child", { operationKey: "artifact.text", semanticId: "child", parentOperationId: a.operationId }));
    expect(await f.invoke("checkFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "fixture/fallback" })).toEqual({ allowed: false });
    await denied(f, () => f.invoke("admitFallback", { reference: f.reference, attemptId: a.attemptId, candidateModelId: "fixture/fallback" }));
    expect(f.account("tenant")).toMatchObject({ settledUnits: 40, reservedUnits: 100, activeConcurrency: 1, overrun: true }); expect(f.attempt(waiting.attemptId).state).toBe("reserved");
  });
});

describe("immutable charge-only coexistence and defensive privacy", () => {
  it.each(["settle", "recover", "reconcileDeploymentLiability"] as const)("%s recognizes drift originals/finals and compatible absent-fact refinement before selected-model comparison", async (route) => {
    const { f, a } = await prepared(); const initial = charge(f, a, null), first = await capture(f, a, initial);
    if (route === "reconcileDeploymentLiability") retired(f);
    const invoke = (receiptCanonical: string) => f.invoke(route, { attemptId: a.attemptId, receiptCanonical, ...(route === "reconcileDeploymentLiability" ? {} : { reference: f.reference }) });
    const writes = f.db.writes; await invoke(initial); expect(f.db.writes).toBe(writes);
    const final = charge(f, a, "0.000150", { actualModel: "foreign/model", usage: { inputTokens: 16, outputTokens: 21 } });
    expect(await invoke(canonicalModelJson({ ...JSON.parse(final) as Record<string, unknown>, privateResultCanonical: "secret" }))).toMatchObject({ state: "settled", settledCostUnits: 150, resultWithheld: true, overrun: true });
    guarded(f, a, 150); const before = rows(f), postWrites = f.db.writes;
    await invoke(initial); await invoke(final); expect(rows(f)).toBe(before); expect(f.db.writes).toBe(postWrites);
    expect(await capture(f, a, initial)).toMatchObject({ evidenceId: first.evidenceId, settledCostUnits: 150 }); expect(f.db.writes).toBe(postWrites);
    await denied(f, () => invoke(charge(f, a, "0.000150", { actualModel: "different/model", usage: { inputTokens: 16, outputTokens: 21 } })));
  });
  it.each(["settle", "recover", "reconcileDeploymentLiability"] as const)("%s existing drift first observation then known40 has parity and no result privilege", async (route) => {
    const { f, a } = await prepared(); const facts = { actualModel: "foreign/model", usage: { inputTokens: 16 } };
    const initial = charge(f, a, null, facts); await capture(f, a, initial); if (route === "reconcileDeploymentLiability") retired(f);
    const args = (receiptCanonical: string) => ({ attemptId: a.attemptId, receiptCanonical, ...(route === "reconcileDeploymentLiability" ? {} : { reference: f.reference }) });
    const firstWrites = f.db.writes; await f.invoke(route, args(initial)); expect(f.db.writes).toBe(firstWrites);
    const final = charge(f, a, "0.000040", facts); await f.invoke(route, args(final)); guarded(f, a, 40);
    const writes = f.db.writes; await f.invoke(route, args(final)); await f.invoke(route, args(initial)); expect(f.db.writes).toBe(writes);
  });
  it("current distinct admin accounts revoked owner liability without authority to deliver; unowned admin/operator targets deny", async () => {
    const { f, a } = await prepared(); await capture(f, a, charge(f, a, null, { actualModel: "foreign/model" })); f.grant.revokedAt = clock;
    const admin = f.db.seed("runtimeAuthGrants", { ...f.grant, _id: "runtimeAuthGrants:current-admin", version: 2 }); delete admin.revokedAt;
    const reference = { ...f.reference, grantId: admin._id, grantVersion: 2 };
    const final = charge(f, a, "0.000150", { actualModel: "foreign/model" });
    await denied(f, () => f.invoke("settle", { reference, attemptId: a.attemptId, receiptCanonical: final }));
    await denied(f, () => f.invoke("reconcileDeploymentLiability", { attemptId: a.attemptId, receiptCanonical: final }));
    await denied(f, () => f.invoke("recover", { reference: { ...reference, tenantId: "unowned" }, attemptId: a.attemptId, receiptCanonical: final }));
    await f.invoke("recover", { reference, attemptId: a.attemptId, receiptCanonical: final }); guarded(f, a, 150);
  });
  it.each(["modelChanged", "modelRemoved", "inputChanged", "usageRemoved", "outputChanged", "receiptChanged", "costChanged"])("immutable %s rejection preserves original/final bytes and all counters", async (kind) => {
    const { f, a } = await prepared(); const facts = { actualModel: "foreign/model", usage: { inputTokens: 16, outputTokens: 21 } };
    const initial = charge(f, a, null, facts); const first = await capture(f, a, initial);
    const changed: Record<string, unknown> = { ...facts };
    if (kind === "modelChanged") changed.actualModel = "other/model";
    if (kind === "modelRemoved") delete changed.actualModel;
    if (kind === "inputChanged") changed.usage = { inputTokens: 15, outputTokens: 21 };
    if (kind === "usageRemoved") delete changed.usage;
    if (kind === "outputChanged") changed.usage = { inputTokens: 16, outputTokens: 20 };
    if (kind === "receiptChanged") changed.receiptId = "different";
    if (kind !== "costChanged") await denied(f, () => capture(f, a, charge(f, a, "0.000040", changed)));
    const final = charge(f, a, "0.000040", facts), last = await capture(f, a, final);
    await denied(f, () => capture(f, a, charge(f, a, kind === "costChanged" ? "0.000041" : "0.000040", changed)));
    const writes = f.db.writes; expect(await capture(f, a, initial)).toEqual(last); expect(await capture(f, a, final)).toEqual(last); expect(f.db.writes).toBe(writes);
    expect(last.evidenceId).toBe(first.evidenceId); expect(f.attempt(a.attemptId).terminalEvidenceCanonical).toBe(initial); expect(f.attempt(a.attemptId).receiptCanonical).toBe(final);
  });
  it("forced equal initial and final digests cannot mask differing canonical observations", async () => {
    const { f, a } = await prepared(); const initial = charge(f, a, null, { actualModel: "foreign/model" }); await capture(f, a, initial);
    const initialHash = f.attempt(a.attemptId).terminalEvidenceHash!, badInitial = charge(f, a, null, { actualModel: "different/model" });
    const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle);
    const spy = jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => new TextDecoder().decode(data as ArrayBuffer) === badInitial ? Uint8Array.from(Buffer.from(initialHash, "hex")).buffer : await digest(algorithm, data));
    await denied(f, () => capture(f, a, badInitial)); spy.mockRestore();
    const final = charge(f, a, "0.000150", { actualModel: "foreign/model" }); await capture(f, a, final); const hash = f.attempt(a.attemptId).receiptHash!, badFinal = charge(f, a, "0.000151", { actualModel: "foreign/model" });
    jest.spyOn(globalThis.crypto.subtle, "digest").mockImplementation(async (algorithm, data) => new TextDecoder().decode(data as ArrayBuffer) === badFinal ? Uint8Array.from(Buffer.from(hash, "hex")).buffer : await digest(algorithm, data));
    await denied(f, () => capture(f, a, badFinal)); guarded(f, a, 150);
  });
  it.each(["pending", "attached"] as const)("inconsistent %s observations deny attachment/replay despite false flags; legacy private bytes survive", async (marker) => {
    for (const location of ["initialModel", "finalModel", "attemptModel", "initialInput", "finalOutput"]) {
      const { f, a, b } = await prepared(); const initial = charge(f, a, null); const first = await capture(f, a, initial);
      await capture(f, a, charge(f, a, "0.000040")); const attempt = f.attempt(a.attemptId);
      if (location.startsWith("initial")) {
        const observation = JSON.parse(attempt.terminalEvidenceCanonical!) as Record<string, unknown>;
        if (location === "initialModel") observation.actualModel = "foreign/model"; else observation.usage = { inputTokens: 16 };
        attempt.terminalEvidenceCanonical = canonicalModelJson(observation); attempt.terminalEvidenceHash = await semanticHash(attempt.terminalEvidenceCanonical);
      } else if (location.startsWith("final")) {
        const observation = JSON.parse(attempt.receiptCanonical!) as Record<string, unknown>;
        if (location === "finalModel") observation.actualModel = "foreign/model"; else observation.usage = { outputTokens: 21 };
        attempt.receiptCanonical = canonicalModelJson(observation); attempt.receiptHash = await semanticHash(attempt.receiptCanonical);
      } else attempt.actualModel = "foreign/model";
      attempt.resultAttachmentState = marker; attempt.resultWithheld = false; attempt.outputVisible = true; attempt.privateResultCanonical = canonicalModelJson({ text: "retained-private-host-bytes" });
      for (const kind of ["tenant", "run"]) f.account(kind).overrun = false; f.db.table("runtimeModelOperations")[0]!.overrun = false;
      const evidenceId = await semanticHash(canonicalModelJson(["native-terminal-evidence-v1", attempt._id, attempt.dispatchIdentity, attempt.terminalEvidenceCanonical, attempt.terminalEvidenceHash]));
      const money = JSON.stringify(f.db.table("runtimeBudgetAccounts")), privateBytes = attempt.privateResultCanonical;
      expect(await attach(f, a, evidenceId)).toEqual({ attached: false, resultWithheld: true }); expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(money); expect(attempt.privateResultCanonical).toBe(privateBytes);
      if (marker === "pending") expect(attempt.resultAttachmentState).toBe("closed");
      await denied(f, () => f.admit(b));
      const duplicateWrites = f.db.writes;
      expect(await f.invoke("settle", { reference: f.reference, attemptId: a.attemptId, receiptCanonical: attempt.receiptCanonical })).toMatchObject({ resultWithheld: true });
      expect(f.db.writes).toBe(duplicateWrites);
      f.grant.revokedAt = clock; expect(await attach(f, a, evidenceId)).toEqual({ attached: false, resultWithheld: true }); delete f.grant.revokedAt;
      const writes = f.db.writes; expect(await attach(f, a, evidenceId)).toEqual({ attached: false, resultWithheld: true }); expect(f.db.writes).toBe(writes);
      expect(first.evidenceId).toHaveLength(64);
    }
  });
  it.each(["settle", "recover", "reconcileDeploymentLiability"] as const)("shared uncaptured %s known violation charges full but never stores new private bytes", async (route) => {
    const { f, a } = await prepared(); if (route === "reconcileDeploymentLiability") retired(f);
    await f.invoke(route, { attemptId: a.attemptId, receiptCanonical: f.receipt(a, "0.000150", { actualModel: "foreign/model", usage: { inputTokens: 16 } }), ...(route === "reconcileDeploymentLiability" ? {} : { reference: f.reference }) });
    expect(f.attempt(a.attemptId)).toMatchObject({ settledCostUnits: 150, resultWithheld: true, actualModel: "foreign/model" }); expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
    expect(f.account("tenant")).toMatchObject({ settledUnits: 150, activeConcurrency: 0, overrun: true });
  });
  it.each(["", " model", "model ", "x".repeat(257), "\ud800"])("malformed observed model %j cannot change capture or counters", async (actualModel) => {
    const { f, a } = await prepared(); await denied(f, () => capture(f, a, charge(f, a, "0.000040", { actualModel })));
    expect(f.account("tenant")).toMatchObject({ reservedUnits: 100, settledUnits: 0, activeConcurrency: 1 });
  });
  it("exact valid256 Unicode observation remains truthful and unnormalized", async () => {
    const { f, a } = await prepared(); const actualModel = "😀".repeat(128); await capture(f, a, charge(f, a, "0.000040", { actualModel }));
    expect(f.attempt(a.attemptId).actualModel).toBe(actualModel); guarded(f, a, 40);
  });
  it.each(["requestedModel", "interface", "dispatch", "proof", "receiptPrivate", "unknownAttempt", "noCheckpoint"])("invalid %s is zero effects", async (kind) => {
    const { f, a } = await admitted(); if (kind !== "noCheckpoint") await f.checkpoint(a);
    const extra: Record<string, unknown> = { actualModel: "foreign/model" };
    if (kind === "requestedModel") extra.modelId = "foreign/model";
    if (kind === "interface") extra.nativeInterface = "embedding";
    if (kind === "dispatch") extra.dispatchIdentity = "wrong";
    if (kind === "proof") extra.proof = "claimed";
    if (kind === "receiptPrivate") extra.privateResultCanonical = "private";
    const receiptCanonical = charge(f, a, "0.000150", extra);
    await denied(f, () => kind === "unknownAttempt" ? f.invoke("captureTerminalEvidence", { attemptId: "runtimeModelAttempts:unowned", dispatchIdentity: f.attempt(a.attemptId).dispatchIdentity, receiptCanonical }) : capture(f, a, receiptCanonical));
  });
});

it("actual Gateway to REGISTERED capture accounts required synthetic known150 drift then QUALIFICATION_OVERRUN, no output/attachment", async () => {
  root.dispatchEvidence[0]!.providerVersion = "0.2.1";
  const f = fixture(); await f.install(); const b = await f.bind();
  const { governGatewayLanguageModel } = await import("../../../convex-dev/runtimeGateway");
  const resolution = await f.invoke<import("../../../convex-dev/runtimeGateway").GatewayResolution>("resolve", { reference: f.reference, operationKey: "agent.respond", runBudgetId: b.runBudgetId });
  const receipts: string[] = []; let nativeCalls = 0, attachments = 0, attemptId = "";
  const composition: import("../../../convex-dev/runtimeGateway").GatewayComposition = { now: () => clock, ledger: {
    resolve: (args) => f.invoke("resolve", args), admit: (args) => f.invoke("admit", args), checkpoint: (args) => f.invoke("checkpoint", args), markVisible: (args) => f.invoke("markVisible", args),
    attachTerminalResult: (args) => { attachments++; return f.invoke("attachTerminalResult", args); },
  }, terminalSink: { capture: (args) => { receipts.push(args.receiptCanonical); attemptId = args.attemptId; return f.invoke<Capture>("captureTerminalEvidence", args) as Promise<import("../../../convex-dev/runtimeGateway").TerminalCaptureAcknowledgment>; } } };
  const model: import("@ai-sdk/provider").LanguageModelV4 = { specificationVersion: "v4", modelId: "openai/gpt-4o-mini", provider: "convexGateway.chat", supportedUrls: {}, doStream: async () => { throw Error("unused"); },
    doGenerate: async () => { nativeCalls++; return { content: [{ type: "text", text: "answer" }], finishReason: { unified: "stop", raw: "stop" }, usage: { inputTokens: { total: 15, noCache: undefined, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 2, text: undefined, reasoning: undefined } }, warnings: [], response: { body: { id: "truthful-observation", model: "foreign/model", choices: [{ finish_reason: "stop" }], usage: { prompt_tokens: 15, completion_tokens: 2, total_tokens: 17, cost: "0.000150" } } } }; } };
  const h = governGatewayLanguageModel(model, composition, { reference: f.reference, operationKey: "agent.respond", runBudgetId: b.runBudgetId, semanticId: "semantic", ordinal: 0 }, resolution);
  await expect(h.model.doGenerate({ prompt: [{ role: "user", content: [{ type: "text", text: "hello" }] }], maxOutputTokens: 20 })).rejects.toMatchObject({ code: "QUALIFICATION_OVERRUN" });
  expect(receipts).toHaveLength(1); expect(JSON.parse(receipts[0]!)).toMatchObject({ actualModel: "foreign/model", modelId: "openai/gpt-4o-mini", aggregateCostUsd: "0.000150", proof: "provider-terminal-v1" });
  expect(f.account("tenant")).toMatchObject({ settledUnits: 150, activeConcurrency: 0, reservedUnits: 0, overrun: true }); expect(f.account("run")).toMatchObject({ settledUnits: 150, activeConcurrency: 0, overrun: true });
  expect(f.attempt(attemptId)).toMatchObject({ resultAttachmentState: "closed", resultWithheld: true, actualModel: "foreign/model", slotReleased: true }); expect(f.attempt(attemptId).privateResultCanonical).toBeUndefined();
  expect(attachments).toBe(0); expect(nativeCalls).toBe(1); await h.lifecycle.complete(); expect(await h.lifecycle.consumeReplay()).toBeUndefined();
  expect(h.lifecycle.pendingWork()).toEqual({ authority: 0, capture: 0, settlement: 0, native: 0, reader: 0, cleanup: 0 });
});


describe("shared unknown observation transition and bounded receipt identities", () => {
  it.each(["settle", "recover", "reconcileDeploymentLiability"] as const)("%s unknown model/token violations retain all liability, release genuine lifetime once and withhold", async (route) => {
    for (const facts of [{ actualModel: "foreign/model" }, { usage: { inputTokens: 16 } }, { usage: { outputTokens: 21 } }]) {
      const { f, a } = await prepared(); if (route === "reconcileDeploymentLiability") retired(f);
      const receiptCanonical = charge(f, a, null, facts);
      await f.invoke(route, { attemptId: a.attemptId, receiptCanonical, ...(route === "reconcileDeploymentLiability" ? {} : { reference: f.reference }) });
      for (const kind of ["tenant", "run"]) expect(f.account(kind)).toMatchObject({ reservedUnits: 0, uncertainUnits: 100, settledUnits: 0, activeConcurrency: 0, overrun: true });
      expect(f.db.table("runtimeModelOperations")[0]).toMatchObject({ uncertainUnits: 100, overrun: true }); expect(f.attempt(a.attemptId)).toMatchObject({ resultWithheld: true, slotReleased: true });
      expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined(); expect(f.attempt(a.attemptId).resultAttachmentState).toBeUndefined();
    }
  });
  it.each(["", " padded", "trailing ", "x".repeat(257), "\ud800"])("receipt ID %j cannot create accounting facts", async (receiptId) => {
    const { f, a } = await prepared(); await denied(f, () => capture(f, a, charge(f, a, "0.000150", { actualModel: "foreign/model", receiptId })));
  });
});
