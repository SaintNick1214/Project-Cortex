/** Offline native-handler fixtures. This fake database does NOT prove Convex OCC/isolation/rollback. */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { MutationCtx } from "/workspace/Project-Cortex/convex-dev/_generated/server";
import type { Doc, Id } from "/workspace/Project-Cortex/convex-dev/_generated/dataModel";
import type { DeploymentPolicyManifest, QualifiedDispatchEvidence } from "/workspace/Project-Cortex/convex-dev/runtimeModelPolicyBootstrap";
import type { ModelCallRequest, TrustedModelPolicyRecord } from "/workspace/Project-Cortex/src/domain/model-policy";
import { canonicalModelJson } from "/workspace/Project-Cortex/src/domain/model-policy";
import { DEFAULT_EMBEDDING_PROFILE, semanticHash } from "/workspace/Project-Cortex/src/domain/profile";
import { memoryFixture } from "/workspace/Project-Cortex/tests/unit/runtimeMemory/fixture";

const lookup = jest.fn<(id: string, revision: number) => DeploymentPolicyManifest | undefined>();
jest.unstable_mockModule("/workspace/Project-Cortex/convex-dev/runtimeModelPolicyBootstrap", () => ({ lookupDeploymentManifest: lookup, isTrustedDeploymentManifest: (entry: DeploymentPolicyManifest) => entry === root && entry.classification === "fixture-synthetic" }));
const ledger = await import("/workspace/Project-Cortex/convex-dev/runtimeModelPolicy");
const schema = (await import("/workspace/Project-Cortex/convex-dev/schema")).default;
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


function charge(f: ReturnType<typeof fixture>, a: Reserved, cost: string | null = "0.000040", extra: Record<string, unknown> = {}) {
 const data = JSON.parse(f.receipt(a)) as Record<string, unknown>; delete data.privateResultCanonical;
 if(cost === null) { delete data.aggregateCostUsd; data.costSource="unavailable"; } else data.aggregateCostUsd=cost;
 return canonicalModelJson({...data,...extra});
}
async function prepared(cost: string | null = "0.000040") {
 const {f,b,a}=await admitted(); await f.checkpoint(a);
 const args={attemptId:a.attemptId,dispatchIdentity:f.attempt(a.attemptId).dispatchIdentity,receiptCanonical:charge(f,a,cost)};
 const c=await f.invoke<{evidenceId:string}>("captureTerminalEvidence",args);
 const attach={reference:f.reference,attemptId:a.attemptId,evidenceId:c.evidenceId,privateResultCanonical:canonicalModelJson({text:"answer"})};
 return {f,b,a,args,c,attach};
}
async function deniedZero(f:ReturnType<typeof fixture>, action:()=>Promise<unknown>) {
 const before=JSON.stringify([...f.db.rows]), writes=f.db.writes;
 await expect(action()).rejects.toThrow(); expect(JSON.stringify([...f.db.rows])).toBe(before); expect(f.db.writes).toBe(writes);
}

it("fresh raw witness: unexpected eligibility fault preserves pending then exact healthy attachment succeeds once",async()=>{
 const {f,a,attach}=await prepared();const before=JSON.stringify([...f.db.rows]),writes=f.db.writes;const query=f.db.query.bind(f.db);const cause=new Error('cause'),error=new Error('DB fault',{cause});
 const spy=jest.spyOn(f.db,'query').mockImplementation((table:string)=>{if(table==='runtimeModelPolicies')throw error;return query(table);});
 let actual:unknown;try{await f.invoke('attachTerminalResult',attach);}catch(e){actual=e;}
 expect(actual).toBe(error);expect((actual as Error).cause).toBe(cause);const afterFault=JSON.stringify([...f.db.rows]),faultWrites=f.db.writes-writes,attachmentAfterFault=f.attempt(a.attemptId).resultAttachmentState;
 expect(afterFault).toBe(before);expect(faultWrites).toBe(0);expect(attachmentAfterFault).toBe('pending');spy.mockRestore();const money=JSON.stringify(f.db.table('runtimeBudgetAccounts'));
 const healthyExactRetry=await f.invoke('attachTerminalResult',attach),retryWrites=f.db.writes-writes;const duplicate=await f.invoke('attachTerminalResult',attach),duplicateWrites=f.db.writes-writes-retryWrites;
 expect(healthyExactRetry).toEqual({attached:true,resultWithheld:false});expect(duplicate).toEqual(healthyExactRetry);expect(retryWrites).toBe(1);expect(duplicateWrites).toBe(0);expect(JSON.stringify(f.db.table('runtimeBudgetAccounts'))).toBe(money);
 const fs=await import('node:fs');fs.writeFileSync('_goals/convex-backend-runtime-2026-10-02/qa/task04-terminal-capture-product-c2-review/fresh-read-failure-witness.json',JSON.stringify({before,afterFault,faultWrites,attachmentAfterFault,originalIdentity:actual===error,originalCause:(actual as Error).cause===cause,healthyExactRetry,retryWrites,duplicate,duplicateWrites,moneyUnchanged:JSON.stringify(f.db.table('runtimeBudgetAccounts'))===money,privateResult:f.attempt(a.attemptId).privateResultCanonical},null,2));
});
