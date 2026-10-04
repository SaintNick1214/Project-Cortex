/** Offline native-handler fixtures. This fake database does NOT prove Convex OCC/isolation/rollback. */
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
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
type Capture = { evidenceId: string; state: "settled" | "confirmed_rejected" | "uncertain"; settledCostUnits?: number; overrun: boolean };
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

it.each([
  ['drift40','foreign/model','0.000040',15,2,40,0],
  ['drift150','foreign/model','0.000150',15,2,150,0],
  ['driftNoCost','foreign/model',undefined,15,2,0,100],
  ['driftUnsupported','foreign/model','0.000040',15,2,0,100],
  ['sameInputKnown','openai/gpt-4o-mini','0.000040',16,2,40,0],
  ['sameOutputUnknown','openai/gpt-4o-mini',undefined,15,21,0,100],
] as const)('independent actual adapter %s persists charge without private delivery',async (kind,served,cost,input,output,units,uncertain)=>{
 root={...root,dispatchEvidence:root.dispatchEvidence.map(p=>({...p,providerVersion:'0.2.1',...(kind==='driftUnsupported'?{terminalCost:'unavailable' as const}:{})}))};
 const f=fixture();await f.install();const b=await f.bind();const gateway=await import('/workspace/Project-Cortex/convex-dev/runtimeGateway');
 const resolution=await f.invoke<any>('resolve',{reference:f.reference,operationKey:'agent.respond',runBudgetId:b.runBudgetId});
 let captures=0,attachments=0,native=0,attemptId='',observed='';
 const h=gateway.governGatewayLanguageModel({specificationVersion:'v4',modelId:'openai/gpt-4o-mini',provider:'convexGateway.chat',supportedUrls:{},doStream:async()=>{throw Error('unused');},doGenerate:async()=>{native++;return {content:[{type:'text',text:'private answer'}],finishReason:{unified:'stop',raw:'stop'},usage:{inputTokens:{total:input},outputTokens:{total:output}},warnings:[],response:{body:{id:'review-terminal',model:served,choices:[{finish_reason:'stop'}],usage:{prompt_tokens:input,completion_tokens:output,total_tokens:input+output,...(cost===undefined?{}:{cost})}}}};}} as any,
 {now:()=>clock,ledger:{resolve:(a:any)=>f.invoke('resolve',a),admit:(a:any)=>f.invoke('admit',a),checkpoint:(a:any)=>f.invoke('checkpoint',a),markVisible:(a:any)=>f.invoke('markVisible',a),attachTerminalResult:(a:any)=>{attachments++;return f.invoke('attachTerminalResult',a);}},terminalSink:{capture:async(a:any)=>{captures++;attemptId=a.attemptId;observed=a.receiptCanonical;return await f.invoke<any>('captureTerminalEvidence',a);}}},
 {reference:f.reference,operationKey:'agent.respond',runBudgetId:b.runBudgetId,semanticId:'semantic',ordinal:0},resolution);
 await expect(h.model.doGenerate({prompt:[{role:'user',content:[{type:'text',text:'hello'}]}],maxOutputTokens:20})).rejects.toMatchObject({code:'QUALIFICATION_OVERRUN'});
 expect([captures,attachments,native]).toEqual([1,0,1]);expect(JSON.parse(observed)).toMatchObject({actualModel:served,modelId:'openai/gpt-4o-mini'});
 for(const k of ['tenant','run'])expect(f.account(k)).toMatchObject({reservedUnits:0,settledUnits:units,uncertainUnits:uncertain,activeConcurrency:0,overrun:true});
 expect(f.db.table('runtimeModelOperations')[0]).toMatchObject({reservedUnits:0,settledUnits:units,uncertainUnits:uncertain,overrun:true});
 const a=f.attempt(attemptId);expect(a).toMatchObject({actualModel:served,resultWithheld:true,resultAttachmentState:'closed',slotReleased:true});expect(a.privateResultCanonical).toBeUndefined();
 const writes=f.db.writes;await f.invoke('captureTerminalEvidence',{attemptId,dispatchIdentity:a.dispatchIdentity,receiptCanonical:observed});expect(f.db.writes).toBe(writes);
 await h.lifecycle.complete();expect(await h.lifecycle.consumeReplay()).toBeUndefined();expect(h.lifecycle.pendingWork()).toEqual({authority:0,capture:0,settlement:0,native:0,reader:0,cleanup:0});
});
it.each(['settle','recover','reconcileDeploymentLiability'] as const)('independent shared %s below monetary ceiling withholds model drift',async route=>{
 const {f,a}=await prepared();if(route==='reconcileDeploymentLiability')retired(f);
 await f.invoke(route,{attemptId:a.attemptId,receiptCanonical:f.receipt(a,'0.000040',{actualModel:'foreign/model'}),...(route==='reconcileDeploymentLiability'?{}:{reference:f.reference})});
 expect(f.attempt(a.attemptId)).toMatchObject({settledCostUnits:40,actualModel:'foreign/model',resultWithheld:true});expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
 for(const k of ['tenant','run'])expect(f.account(k)).toMatchObject({settledUnits:40,activeConcurrency:0,overrun:true});
});
it.each(['pending','attached'] as const)('independent healthy-rights %s refuses final-token observation despite false flags',async marker=>{
 const {f,a,b}=await prepared();await capture(f,a,charge(f,a,null));await capture(f,a,charge(f,a));const at=f.attempt(a.attemptId);
 const final=JSON.parse(at.receiptCanonical!);final.usage={outputTokens:21};at.receiptCanonical=canonicalModelJson(final);at.receiptHash=await semanticHash(at.receiptCanonical);
 at.resultAttachmentState=marker;at.resultWithheld=false;at.privateResultCanonical=canonicalModelJson({text:'host retained bytes'});at.outputVisible=true;
 for(const k of ['tenant','run'])f.account(k).overrun=false;f.db.table('runtimeModelOperations')[0]!.overrun=false;
 const id=await semanticHash(canonicalModelJson(['native-terminal-evidence-v1',at._id,at.dispatchIdentity,at.terminalEvidenceCanonical,at.terminalEvidenceHash]));
 const accounts=JSON.stringify(f.db.table('runtimeBudgetAccounts')),privateBytes=at.privateResultCanonical,writes=f.db.writes;
 expect(await attach(f,a,id)).toEqual({attached:false,resultWithheld:true});expect(JSON.stringify(f.db.table('runtimeBudgetAccounts'))).toBe(accounts);expect(at.privateResultCanonical).toBe(privateBytes);expect(f.db.writes-writes).toBe(marker==='pending'?1:0);
 await denied(f,()=>f.admit(b));const dw=f.db.writes;expect(await f.invoke('settle',{reference:f.reference,attemptId:a.attemptId,receiptCanonical:at.receiptCanonical})).toMatchObject({resultWithheld:true});expect(f.db.writes).toBe(dw);
});
