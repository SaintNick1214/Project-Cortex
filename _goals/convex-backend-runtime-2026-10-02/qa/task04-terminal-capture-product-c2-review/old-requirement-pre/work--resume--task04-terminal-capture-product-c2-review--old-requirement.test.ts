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
describe("independent hostile outcomes",()=>{
 it("late expired-root revoked live refinement preserves exact original windows and initial identity",async()=>{
  const {f,a,args,c}=await prepared(null); const initial=f.attempt(a.attemptId).terminalEvidenceCanonical;
  f.grant.revokedAt=clock; jest.spyOn(Date,"now").mockReturnValue(root.dispatchEvidence[0]!.expiresAt+1);
  const window=f.account("run").windowId; const final={...args,receiptCanonical:charge(f,a,"0.000150")};
  expect(await f.invoke("captureTerminalEvidence",final)).toMatchObject({evidenceId:c.evidenceId,settledCostUnits:150,overrun:true});
  expect(f.account("run")).toMatchObject({windowId:window,settledUnits:150,uncertainUnits:0,activeConcurrency:0});
  expect(f.attempt(a.attemptId)).toMatchObject({terminalEvidenceCanonical:initial,resultAttachmentState:"closed"});
  const writes=f.db.writes; expect(await f.invoke("captureTerminalEvidence",args)).toMatchObject({settledCostUnits:150}); expect(f.db.writes).toBe(writes);
 });
 it.each(["inputTokens","outputTokens","totalTokens","cachedInputTokens","reasoningTokens"])("known %s cannot disappear during refinement",async key=>{
  const {f,a}=await admitted(); await f.checkpoint(a);
  const args={attemptId:a.attemptId,dispatchIdentity:f.attempt(a.attemptId).dispatchIdentity,receiptCanonical:charge(f,a,null,{usage:{[key]:0}})};
  await f.invoke("captureTerminalEvidence",args);
  await deniedZero(f,()=>f.invoke("captureTerminalEvidence",{...args,receiptCanonical:charge(f,a,"0.000040")}));
 });
 it("nonterminal legacy recovery keeps active slot then first genuine capture may settle",async()=>{
  const {f,a}=await admitted(); await f.checkpoint(a);
  await f.invoke("settle",{reference:f.reference,attemptId:a.attemptId,receiptCanonical:canonicalModelJson({proof:"absent"})});
  expect(f.attempt(a.attemptId).terminalEvidenceCanonical).toBeUndefined(); expect(f.account("run").activeConcurrency).toBe(1);
  const args={attemptId:a.attemptId,dispatchIdentity:f.attempt(a.attemptId).dispatchIdentity,receiptCanonical:charge(f,a,"0.000040")};
  expect(await f.invoke("captureTerminalEvidence",args)).toMatchObject({settledCostUnits:40}); expect(f.account("run").activeConcurrency).toBe(0);
 });
 it("caller cannot assert qualification by receipt extra trust flags",async()=>{
  const {f,a}=await admitted(); await f.checkpoint(a);
  await deniedZero(f,()=>f.invoke("captureTerminalEvidence",{attemptId:a.attemptId,dispatchIdentity:f.attempt(a.attemptId).dispatchIdentity,receiptCanonical:charge(f,a,"0.000040",{trusted:true,coversAllProviderCharges:true})}));
 });
 it("partial capture marker denies ordinary replay with zero effects",async()=>{
  const {f,b,a}=await prepared(); f.attempt(a.attemptId).resultAttachmentState=undefined;
  await deniedZero(f,()=>f.admit(b));
 });
 it("parent cancellation closes pending child and renewal cannot reopen",async()=>{
  const {f,b,a}=await admitted(); await f.checkpoint(a);
  const child=await f.invoke<Reserved>("admit",{reference:f.reference,operationKey:"artifact.text",runBudgetId:b.runBudgetId,semanticId:"child",ordinal:0,requestCanonical:canonicalModelJson(request()),parentOperationId:a.operationId});
  await f.checkpoint(child);
  const c=await f.invoke<{evidenceId:string}>("captureTerminalEvidence",{attemptId:child.attemptId,dispatchIdentity:f.attempt(child.attemptId).dispatchIdentity,receiptCanonical:charge(f,child)});
  const attach={reference:f.reference,attemptId:child.attemptId,evidenceId:c.evidenceId,privateResultCanonical:canonicalModelJson({text:"answer"})};
  f.db.table("runtimeModelOperations").find(x=>x._id===a.operationId)!.cancelled=true;
  const money=JSON.stringify(f.db.table("runtimeBudgetAccounts"));
  expect(await f.invoke("attachTerminalResult",attach)).toEqual({attached:false,resultWithheld:true});
  f.db.table("runtimeModelOperations").find(x=>x._id===a.operationId)!.cancelled=false;
  expect(await f.invoke("attachTerminalResult",attach)).toEqual({attached:false,resultWithheld:true});
  expect(f.attempt(child.attemptId).privateResultCanonical).toBeUndefined(); expect(JSON.stringify(f.db.table("runtimeBudgetAccounts"))).toBe(money);
 });
 it("unexpected eligibility read failure must propagate without permanently closing pending attachment",async()=>{
  const {f,a,attach}=await prepared(); const query=f.db.query.bind(f.db);
  jest.spyOn(f.db,"query").mockImplementation((table:string)=>{if(table==="runtimeModelPolicies") throw new Error("synthetic transient database read failure");return query(table);});
  await deniedZero(f,()=>f.invoke("attachTerminalResult",attach));
  expect(f.attempt(a.attemptId).resultAttachmentState).toBe("pending");
 });
});
