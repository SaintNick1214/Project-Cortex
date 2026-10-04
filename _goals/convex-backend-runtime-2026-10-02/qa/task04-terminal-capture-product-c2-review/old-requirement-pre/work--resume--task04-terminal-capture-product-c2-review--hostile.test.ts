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
const { ConvexError } = await import("convex/values");
const envelope = () => ({version:1,code:"FORBIDDEN",retryable:false,outcome:"not_dispatched",message:"arbitrary diagnostic"});
function inject(f:ReturnType<typeof fixture>, value:unknown) {
 const query=f.db.query.bind(f.db);
 return jest.spyOn(f.db,"query").mockImplementation((table:string)=>{if(table==="runtimeModelPolicies") throw value;return query(table);});
}
async function exactFailure(f:ReturnType<typeof fixture>, error:unknown, action:()=>Promise<unknown>) {
 const rows=JSON.stringify([...f.db.rows]), writes=f.db.writes;
 let caught=false; try {await action();} catch(actual) {caught=true;expect(actual).toBe(error);}
 expect(caught).toBe(true);expect(JSON.stringify([...f.db.rows])).toBe(rows);expect(f.db.writes).toBe(writes);
}
const malformed = [
 ['unknownCode',{code:'DB_FAILURE'}],['retryable',{retryable:true}],['missingRetryable',{retryable:undefined}],
 ['stringVersion',{version:'1'}],['wrongVersion',{version:2}],['missingVersion',{version:undefined}],
 ['confirmedOutcome',{outcome:'confirmed'}],['missingOutcome',{outcome:undefined}],['stringRetryable',{retryable:'false'}],
 ['codeArray',{code:['FORBIDDEN']}],['unknownNotDispatched',{code:'QUOTA_EXHAUSTED'}],['nullCode',{code:null}],
] as const;
describe('fresh C2 error boundary and exact recovery',()=>{
 it.each(['attach','capture'])('unexpected database fault at %s preserves full state then same args recover once',async stage=>{
  const {f,a}=await admitted();await f.checkpoint(a);
  const args={attemptId:a.attemptId,dispatchIdentity:f.attempt(a.attemptId).dispatchIdentity,receiptCanonical:charge(f,a)};
  const first=stage==='attach'?await f.invoke<{evidenceId:string}>('captureTerminalEvidence',args):undefined;
  const attach={reference:f.reference,attemptId:a.attemptId,evidenceId:first?.evidenceId??'',privateResultCanonical:canonicalModelJson({text:'answer'})};
  const cause=new Error('read subsystem unavailable'), error=new Error('FORBIDDEN: POLICY_DENIED: temporary database fault',{cause});
  const spy=inject(f,error);await exactFailure(f,error,()=>f.invoke(stage==='attach'?'attachTerminalResult':'captureTerminalEvidence',stage==='attach'?attach:args));
  expect(error.cause).toBe(cause);expect(f.attempt(a.attemptId).resultAttachmentState).toBe(stage==='attach'?'pending':undefined);
  if(stage==='capture') {expect(f.attempt(a.attemptId).terminalEvidenceHash).toBeUndefined();expect(f.account('tenant')).toMatchObject({reservedUnits:100,settledUnits:0,uncertainUnits:0,activeConcurrency:1});}
  spy.mockRestore(); const result=await f.invoke(stage==='attach'?'attachTerminalResult':'captureTerminalEvidence',stage==='attach'?attach:args);
  expect(result).toMatchObject(stage==='attach'?{attached:true,resultWithheld:false}:{settledCostUnits:40,state:'settled'});
  expect(f.account('tenant')).toMatchObject({reservedUnits:0,settledUnits:40,uncertainUnits:0,activeConcurrency:0});
  const rows=JSON.stringify([...f.db.rows]), writes=f.db.writes;
  expect(await f.invoke(stage==='attach'?'attachTerminalResult':'captureTerminalEvidence',stage==='attach'?attach:args)).toEqual(result);
  expect(JSON.stringify([...f.db.rows])).toBe(rows);expect(f.db.writes).toBe(writes);
 });
 it.each(malformed)('native envelope %s must propagate and retain pending attachment',async (_name,change)=>{
  const {f,a,attach}=await prepared();const error=new ConvexError({...envelope(),...change});const spy=inject(f,error);
  await exactFailure(f,error,()=>f.invoke('attachTerminalResult',attach));expect(f.attempt(a.attemptId).resultAttachmentState).toBe('pending');
  spy.mockRestore();expect(await f.invoke('attachTerminalResult',attach)).toEqual({attached:true,resultWithheld:false});
 });
 it.each(['plainError','lookalike','primitive','null','subclass','nullDataPrototype','inheritedEnvelope','missingData','dataGetter','versionGetter','retryableGetter','outcomeGetter','codeGetter','descriptorTrap','dataPrototypeTrap','errorPrototypeTrap','revokedProxy'])('hostile %s preserves original thrown value and calls no getters',async kind=>{
  const {f,a,attach}=await prepared();let calls=0;const noGet=()=>{calls++;throw new Error('getter must not execute');};
  let error:unknown=new Error('FORBIDDEN: forged runtime message');
  if(kind==='lookalike')error={name:'ConvexError',data:envelope()};
  if(kind==='primitive')error='POLICY_DENIED: forged';if(kind==='null')error=null;
  if(kind==='subclass'){class SubError extends ConvexError<any>{};error=new SubError(envelope());}
  if(kind==='nullDataPrototype'){const e=new ConvexError(envelope());Object.setPrototypeOf(e.data,null);error=e;}
  if(kind==='inheritedEnvelope'){const e=new ConvexError(envelope());e.data=Object.create(envelope());error=e;}
  if(kind==='missingData'){const e=new ConvexError(envelope());delete (e as any).data;error=e;}
  if(kind==='dataGetter')error=Object.defineProperty(new ConvexError(envelope()),'data',{get:noGet});
  if(['versionGetter','retryableGetter','outcomeGetter','codeGetter'].includes(kind)){const e=new ConvexError(envelope());Object.defineProperty(e.data,kind.replace('Getter',''),{get:noGet});error=e;}
  if(kind==='descriptorTrap'){const e=new ConvexError(envelope());e.data=new Proxy(e.data,{ownKeys(){throw new Error('inspection failed');}});error=e;}
  if(kind==='dataPrototypeTrap'){const e=new ConvexError(envelope());e.data=new Proxy(e.data,{getPrototypeOf(){throw new Error('inspection failed');}});error=e;}
  if(kind==='errorPrototypeTrap')error=new Proxy(new ConvexError(envelope()),{getPrototypeOf(){throw new Error('inspection failed');}});
  if(kind==='revokedProxy'){const pair=Proxy.revocable(new ConvexError(envelope()),{});pair.revoke();error=pair.proxy;}
  const spy=inject(f,error);await exactFailure(f,error,()=>f.invoke('attachTerminalResult',attach));expect(calls).toBe(0);
  expect(f.attempt(a.attemptId).resultAttachmentState).toBe('pending');spy.mockRestore();expect(await f.invoke('attachTerminalResult',attach)).toEqual({attached:true,resultWithheld:false});
 });
 const controlCodes=['FORBIDDEN','UNAUTHENTICATED','AUTHORITY_LOOKUP_AMBIGUOUS','RUN_CANCELLED','INVALID_INPUT','POLICY_DENIED','CAPABILITY_UNAVAILABLE','CAPABILITY_UNSUPPORTED','PROFILE_NOT_READY','IDEMPOTENCY_CONFLICT'];
 it.each(controlCodes.flatMap(code=>['not_dispatched','uncertain'].map(outcome=>[code,outcome])))('recognized %s/%s closes exactly once without getters or monetary change',async(code,outcome)=>{
  const {f,a,attach}=await prepared();const e=new ConvexError({...envelope(),code,outcome});let getterCalls=0;
  Object.defineProperty(e,'message',{get(){getterCalls++;throw new Error('message should not be read');}});
  Object.defineProperty(e,'cause',{get(){getterCalls++;throw new Error('cause should not be read');}});
  Object.defineProperty(e.data,'message',{get(){getterCalls++;throw new Error('data.message should not be read');}});
  const money=JSON.stringify(f.db.table('runtimeBudgetAccounts'));const writes=f.db.writes;const spy=inject(f,e);
  expect(await f.invoke('attachTerminalResult',attach)).toEqual({attached:false,resultWithheld:true});expect(f.db.writes-writes).toBe(1);
  expect(f.attempt(a.attemptId).resultAttachmentState).toBe('closed');expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
  expect(JSON.stringify(f.db.table('runtimeBudgetAccounts'))).toBe(money);expect(getterCalls).toBe(0);spy.mockRestore();
  const closedRows=JSON.stringify([...f.db.rows]),closedWrites=f.db.writes;expect(await f.invoke('attachTerminalResult',attach)).toEqual({attached:false,resultWithheld:true});
  expect(JSON.stringify([...f.db.rows])).toBe(closedRows);expect(f.db.writes).toBe(closedWrites);
 });
 it.each(['revoked','cancelled','retired','expiredRoot','narrowed'])('genuine %s eligibility loss closes permanently with unchanged charge',async kind=>{
  const {f,a,attach}=await prepared();const money=JSON.stringify(f.db.table('runtimeBudgetAccounts'));
  const op=f.db.table('runtimeModelOperations').find(x=>x._id===a.operationId)!;
  if(kind==='revoked')f.grant.revokedAt=clock;if(kind==='cancelled')op.cancelled=true;
  if(kind==='retired')f.db.seed('runtimeAuthTombstones',{tenantId:f.reference.tenantId,resourceType:'tenant',resourceId:f.reference.tenantId,deletedAt:clock});
  if(kind==='expiredRoot')jest.spyOn(Date,'now').mockReturnValue(root.dispatchEvidence[0]!.expiresAt+1);
  if(kind==='narrowed') {const p=f.db.table('runtimeModelPolicies').find(x=>x.scope==='deployment')!; const record=JSON.parse(p.canonical as string);record.rules.limits.outputTokens=1;p.canonical=canonicalModelJson(record);}
  expect(await f.invoke('attachTerminalResult',attach)).toEqual({attached:false,resultWithheld:true});expect(f.attempt(a.attemptId).resultAttachmentState).toBe('closed');
  delete f.grant.revokedAt;op.cancelled=false;if(kind==='retired')f.db.rows.set('runtimeAuthTombstones',[]);jest.spyOn(Date,'now').mockReturnValue(clock);
  const writes=f.db.writes;expect(await f.invoke('attachTerminalResult',attach)).toEqual({attached:false,resultWithheld:true});expect(f.db.writes).toBe(writes);
  expect(JSON.stringify(f.db.table('runtimeBudgetAccounts'))).toBe(money);expect(f.attempt(a.attemptId).privateResultCanonical).toBeUndefined();
 });
});

describe('fresh C2 remaining design outcomes',()=>{
 it('revoked LIVE scope unknown100 refines full150 on expired historical root; old and final retries preserve immutable identity',async()=>{
  const {f,a,args,c}=await prepared(null);const initial=f.attempt(a.attemptId).terminalEvidenceCanonical,initialHash=f.attempt(a.attemptId).terminalEvidenceHash;
  const windows=f.db.table('runtimeBudgetAccounts').map(x=>({id:x._id,window:x.windowId}));f.grant.revokedAt=clock;jest.spyOn(Date,'now').mockReturnValue(root.dispatchEvidence[0]!.expiresAt+1);
  const final={...args,receiptCanonical:charge(f,a,'0.000150',{actualModel:'openai/gpt-4o-mini',usage:{inputTokens:0,outputTokens:0,totalTokens:0}})};
  const result=await f.invoke('captureTerminalEvidence',final);expect(result).toMatchObject({evidenceId:c.evidenceId,settledCostUnits:150,overrun:true});
  for(const account of f.db.table('runtimeBudgetAccounts').filter(x=>['run','tenant'].includes(x.kind as string)))expect(account).toMatchObject({reservedUnits:0,settledUnits:150,uncertainUnits:0,activeConcurrency:0,overrun:true});
  expect(f.db.table('runtimeBudgetAccounts').map(x=>({id:x._id,window:x.windowId}))).toEqual(windows);
  expect(f.attempt(a.attemptId)).toMatchObject({terminalEvidenceCanonical:initial,terminalEvidenceHash:initialHash,resultAttachmentState:'closed'});
  const rows=JSON.stringify([...f.db.rows]),writes=f.db.writes;expect(await f.invoke('captureTerminalEvidence',args)).toMatchObject({evidenceId:c.evidenceId,settledCostUnits:150});
  expect(await f.invoke('captureTerminalEvidence',final)).toEqual(result);expect(JSON.stringify([...f.db.rows])).toBe(rows);expect(f.db.writes).toBe(writes);
  await deniedZero(f,()=>f.invoke('captureTerminalEvidence',{...final,receiptCanonical:charge(f,a,'0.000151')}));
 });
 it.each(['inputTokens','outputTokens','totalTokens','cachedInputTokens','reasoningTokens'])('refinement cannot remove stored %s',async key=>{
  const {f,a}=await admitted();await f.checkpoint(a);const args={attemptId:a.attemptId,dispatchIdentity:f.attempt(a.attemptId).dispatchIdentity,receiptCanonical:charge(f,a,null,{usage:{[key]:0}})};
  await f.invoke('captureTerminalEvidence',args);await deniedZero(f,()=>f.invoke('captureTerminalEvidence',{...args,receiptCanonical:charge(f,a)}));
 });
 it('cancelled parent closes pending child without another money write',async()=>{
  const {f,b,a}=await admitted();await f.checkpoint(a);const child=await f.invoke<Reserved>('admit',{reference:f.reference,operationKey:'artifact.text',runBudgetId:b.runBudgetId,semanticId:'child',ordinal:0,requestCanonical:canonicalModelJson(request()),parentOperationId:a.operationId});await f.checkpoint(child);
  const captured=await f.invoke<{evidenceId:string}>('captureTerminalEvidence',{attemptId:child.attemptId,dispatchIdentity:f.attempt(child.attemptId).dispatchIdentity,receiptCanonical:charge(f,child)});
  const attach={reference:f.reference,attemptId:child.attemptId,evidenceId:captured.evidenceId,privateResultCanonical:canonicalModelJson({text:'answer'})};const money=JSON.stringify(f.db.table('runtimeBudgetAccounts'));
  const parent=f.db.table('runtimeModelOperations').find(x=>x._id===a.operationId)!;parent.cancelled=true;expect(await f.invoke('attachTerminalResult',attach)).toEqual({attached:false,resultWithheld:true});
  parent.cancelled=false;const writes=f.db.writes;expect(await f.invoke('attachTerminalResult',attach)).toEqual({attached:false,resultWithheld:true});expect(f.db.writes).toBe(writes);expect(JSON.stringify(f.db.table('runtimeBudgetAccounts'))).toBe(money);
 });
 it('partial marker cannot bypass current replay and writes nothing',async()=>{const {f,b,a}=await prepared();delete (f.attempt(a.attemptId) as any).resultAttachmentState;await deniedZero(f,()=>f.admit(b));});
 it('unsupported absent proof never becomes stored terminal and cannot prevent later genuine capture',async()=>{
  const {f,a}=await admitted();await f.checkpoint(a);await f.invoke('settle',{reference:f.reference,attemptId:a.attemptId,receiptCanonical:canonicalModelJson({proof:'absent'})});
  expect(f.attempt(a.attemptId).terminalEvidenceCanonical).toBeUndefined();expect(f.account('run').activeConcurrency).toBe(1);
  expect(await f.invoke('captureTerminalEvidence',{attemptId:a.attemptId,dispatchIdentity:f.attempt(a.attemptId).dispatchIdentity,receiptCanonical:charge(f,a)})).toMatchObject({settledCostUnits:40});expect(f.account('run').activeConcurrency).toBe(0);
 });
});
