import { internalMutationGeneric, internalQueryGeneric, type GenericMutationCtx, type GenericQueryCtx, type GenericDataModel } from "convex/server";
import { v } from "convex/values";
import { CASES, ORDER, BINDING, PROFILE } from "./compiled.ts";
import { canonical, parseCanonical, exact, digest } from "./canonical.ts";
type Write = GenericMutationCtx<GenericDataModel>;
type Read = GenericQueryCtx<GenericDataModel>;
export type Case = typeof CASES[number];
type Attempt = { scenarioId:string; dispatchIdentity:string; identityCanonical:string; state:"dispatch_pending"|"unknown"|"terminal"; checkpoint:true; slotReleased:boolean; k:number; known:number|null; firstCapture:string|null; refinements:string[]; attachment:"pending"|"attached"|"closed"; privateCanonical:string|null };
type State = { binding:typeof BINDING; hypothesis:true; evidenceScope:"nonpaid-peer-offline"; next:number; active:string|null; reserved:number; known:number; stopped:boolean; overrun:boolean; revoked:boolean; cancelled:boolean; sourceCurrent:boolean; profileCurrent:boolean; proofCurrent:boolean; windowCurrent:boolean; attempts:Attempt[] };
const fixedArgs = { ownerRunId:v.string(), scenarioId:v.string(), principal:v.string() };
function safeAdd(a:number,b:number) { const n=a+b; if (!Number.isSafeInteger(n) || n<0) throw new Error("MONEY_OVERFLOW"); return n; }
function caseFor(id:string):Case { const c=CASES.find(c=>c.scenarioId===id); if (!c) throw new Error("NO_PERMIT"); return c; }
function assertFixed(s:State) { if (canonical(s.binding)!==canonical(BINDING) || !s.hypothesis || s.evidenceScope!=="nonpaid-peer-offline") throw new Error("BINDING_CONFLICT"); }
function authority(s:State, principal:string, ownerRunId:string) { assertFixed(s); if(principal!==BINDING.principal || ownerRunId!==BINDING.ownerRunId) throw new Error("FORBIDDEN"); }
function current(s:State) { return !s.revoked&&!s.cancelled&&s.sourceCurrent&&s.profileCurrent&&s.proofCurrent&&s.windowCurrent&&!s.stopped; }
async function load(ctx:Read) {
  const row=await ctx.db.query("experimentControls").withIndex("by_key",q=>q.eq("key",BINDING.accountId)).unique();
  if (!row) throw new Error("NOT_PROVISIONED");
  const s=parseCanonical(row.stateCanonical) as State; assertFixed(s); return {row,s};
}
async function save(ctx:Write,row:Awaited<ReturnType<typeof load>>["row"],s:State) { await ctx.db.replace(row._id,{key:BINDING.accountId,stateCanonical:canonical(s)}); }
export const provision = internalMutationGeneric({args:{},handler:async ctx=>{
  const existing=await ctx.db.query("experimentControls").withIndex("by_key",q=>q.eq("key",BINDING.accountId)).unique();
  if(existing) { assertFixed(parseCanonical(existing.stateCanonical) as State); return {created:false}; }
  const s:State={binding:BINDING,hypothesis:true,evidenceScope:"nonpaid-peer-offline",next:0,active:null,reserved:0,known:0,stopped:false,overrun:false,revoked:false,cancelled:false,sourceCurrent:true,profileCurrent:true,proofCurrent:true,windowCurrent:true,attempts:[]};
  await ctx.db.insert("experimentControls",{key:BINDING.accountId,stateCanonical:canonical(s)}); return {created:true};
}});
export const reserveCheckpoint = internalMutationGeneric({args:fixedArgs,handler:async(ctx,args)=>{
  exact(args,["ownerRunId","scenarioId","principal"]); const {row,s}=await load(ctx); authority(s,args.principal,args.ownerRunId); const c=caseFor(args.scenarioId);
  const existing=s.attempts.find(a=>a.scenarioId===c.scenarioId);
  // Every replay, including lost response, is persistence-only. It never returns another dispatch ticket.
  if(existing) return {dispatch:false,dispatchIdentity:existing.dispatchIdentity,status:existing.state};
  if (!current(s)||s.active!==null||ORDER[s.next]!==c.scenarioId||s.next>=14) throw new Error("PERMIT_DENIED");
  const identityCanonical=canonical({binding:BINDING,case:c}); const dispatchIdentity=await digest(identityCanonical);
  const a:Attempt={scenarioId:c.scenarioId,dispatchIdentity,identityCanonical,state:"dispatch_pending",checkpoint:true,slotReleased:false,k:c.candidateReservationKMicroUSD,known:null,firstCapture:null,refinements:[],attachment:"pending",privateCanonical:null};
  // Provisional experiment K only. Atomic reserve+durable checkpoint BEFORE caller gets one closure ticket.
  s.reserved=safeAdd(s.reserved,a.k); s.active=a.scenarioId; s.next++; s.attempts.push(a); await save(ctx,row,s);
  return {dispatch:true,dispatchIdentity,status:a.state};
}});
export const control = internalMutationGeneric({args:{event:v.union(v.literal("revoke"),v.literal("cancel"),v.literal("source_stale"),v.literal("profile_stale"),v.literal("proof_expired"),v.literal("window_retired"))},handler:async(ctx,{event})=>{
  const {row,s}=await load(ctx);
  if(event==="revoke")s.revoked=true;if(event==="cancel")s.cancelled=true;if(event==="source_stale")s.sourceCurrent=false;if(event==="profile_stale")s.profileCurrent=false;if(event==="proof_expired")s.proofCurrent=false;if(event==="window_retired")s.windowCurrent=false;
  for(const a of s.attempts) {a.attachment="closed";a.privateCanonical=null;}
  await save(ctx,row,s);return {closed:true};
}});
/** Internal nonpaid fixture evidence only: no provider/model/currency readiness attestation. */
export type Observation = { version:1; evidenceScope:"nonpaid-peer-offline"; dispatchIdentity:string; nativeHash:string; terminalId:string; lifetime:"unknown"|"qualified-terminal"; money:"unknown"|"qualified-experiment-observation"; microUSD:number|null; currency:string; category:string; hypothesisValidated:boolean; resultHash:string|null; usageInput:number|null; usageOutput:number|null };
function observation(text:string):Observation {
  const value=parseCanonical(text,8192);exact(value,["version","evidenceScope","dispatchIdentity","nativeHash","terminalId","lifetime","money","microUSD","currency","category","hypothesisValidated","resultHash","usageInput","usageOutput"]);
  if(value.version!==1||value.evidenceScope!=="nonpaid-peer-offline"||typeof value.dispatchIdentity!=="string"||typeof value.nativeHash!=="string"||typeof value.terminalId!=="string"||!value.terminalId||!["unknown","qualified-terminal"].includes(String(value.lifetime))||!["unknown","qualified-experiment-observation"].includes(String(value.money))||typeof value.currency!=="string"||typeof value.category!=="string"||typeof value.hypothesisValidated!=="boolean"||(value.resultHash!==null&&(typeof value.resultHash!=="string"||!/^[a-f0-9]{64}$/.test(value.resultHash))))throw new Error("OBSERVATION_SHAPE");
  for(const key of ["microUSD","usageInput","usageOutput"])if(value[key]!==null&&(!Number.isSafeInteger(value[key])||Number(value[key])<0))throw new Error("OBSERVATION_NUMBER");
  return value as Observation;
}
export const capture = internalMutationGeneric({args:{scenarioId:v.string(),dispatchIdentity:v.string(),observationCanonical:v.string()},handler:async(ctx,args)=>{
  exact(args,["scenarioId","dispatchIdentity","observationCanonical"]);const {row,s}=await load(ctx),c=caseFor(args.scenarioId),a=s.attempts.find(a=>a.scenarioId===args.scenarioId);
  if(!a||!a.checkpoint||a.dispatchIdentity!==args.dispatchIdentity)throw new Error("DISPATCH_CONFLICT");
  let r:Observation;
  try {r=observation(args.observationCanonical);}catch {
    // Invalid observational shape is a conservative STOP, never transaction rollback that loses uncertainty.
    if(a.known===null)a.state="unknown";s.stopped=true;a.attachment="closed";await save(ctx,row,s);return {status:"invalid-retained",slotReleased:a.slotReleased};
  }
  if(r.dispatchIdentity!==a.dispatchIdentity||r.nativeHash!==c.normalizedNativeRequestHash)throw new Error("IDENTITY_CONFLICT");
  if(a.firstCapture===args.observationCanonical||a.refinements.includes(args.observationCanonical))return {status:a.state,slotReleased:a.slotReleased};
  const qualified=r.hypothesisValidated&&r.currency==="USD"&&r.category==="aggregate-inference";
  if(a.firstCapture!==null) {
    const first=observation(a.firstCapture);
    if(a.known!==null||r.terminalId!==first.terminalId||r.resultHash!==first.resultHash||(first.lifetime==="qualified-terminal"&&r.lifetime!==first.lifetime)||r.money!=="qualified-experiment-observation"||r.microUSD===null||!qualified)throw new Error("CAPTURE_COLLISION");
    a.refinements.push(args.observationCanonical);
  }else a.firstCapture=args.observationCanonical;
  const known=qualified&&r.money==="qualified-experiment-observation"&&r.microUSD!==null?r.microUSD:null;
  if(known!==null){
    // Full known liability survives retired window/revocation/cancel/source. Never clip above provisional K.
    s.known=safeAdd(s.known,known);s.reserved-=a.k;a.known=known;
    if(known>a.k){s.overrun=true;s.stopped=true;}
  }
  const terminal=qualified&&r.lifetime==="qualified-terminal";
  if(terminal&&!a.slotReleased){a.slotReleased=true;if(s.active!==a.scenarioId)throw new Error("SLOT_CONFLICT");s.active=null;}
  a.state=terminal?"terminal":"unknown";
  const usageValid=r.usageInput!==null&&r.usageInput<=c.inputU&&r.usageOutput!==null&&r.usageOutput<=c.maximumOutputM;
  if(!qualified||!usageValid){s.stopped=true;}
  if(known===null||!terminal||!current(s)||!usageValid||r.resultHash===null||a.refinements.length>0)a.attachment="closed";
  await save(ctx,row,s);return {status:a.state,slotReleased:a.slotReleased};
}});
function resultValid(c:Case,text:string) {
  const value=parseCanonical(text,c.conditionalPrivateMaximumBytes);
  if(c.nativeInterface==="chat") {exact(value,["text"]);if(typeof value.text!=="string")throw new Error("RESULT_SHAPE");}
  else {exact(value,["profile","vector"]);if(canonical(value.profile)!==canonical(PROFILE)||!Array.isArray(value.vector)||value.vector.length!==1536||value.vector.some(v=>typeof v!=="number"||!Number.isFinite(v)||Object.is(v,-0)))throw new Error("RESULT_PROFILE");}
}
export const attach = internalMutationGeneric({args:{...fixedArgs,dispatchIdentity:v.string(),privateResultCanonical:v.string()},handler:async(ctx,args)=>{
  exact(args,["ownerRunId","scenarioId","principal","dispatchIdentity","privateResultCanonical"]);const {row,s}=await load(ctx);authority(s,args.principal,args.ownerRunId);const a=s.attempts.find(a=>a.scenarioId===args.scenarioId),c=caseFor(args.scenarioId);
  if(!a||a.dispatchIdentity!==args.dispatchIdentity)throw new Error("IDENTITY_CONFLICT");
  if(a.attachment==="closed")return {attached:false};
  if(!current(s)||a.state!=="terminal"||a.known===null){a.attachment="closed";a.privateCanonical=null;await save(ctx,row,s);return {attached:false};}
  resultValid(c,args.privateResultCanonical);
  const r=observation(a.firstCapture!);if(await digest(args.privateResultCanonical)!==r.resultHash)throw new Error("RESULT_COLLISION");
  if(a.attachment==="attached"&&a.privateCanonical!==args.privateResultCanonical)throw new Error("RESULT_COLLISION");
  a.attachment="attached";a.privateCanonical=args.privateResultCanonical;await save(ctx,row,s);return {attached:true};
}});
export const inspect = internalQueryGeneric({args:{},handler:async ctx=>{
  const {s}=await load(ctx);return {classification:"OFFLINE_HYPOTHESIS_ONLY",manifestHash:BINDING.manifestHash,targetHash:BINDING.targetHash,sourceHash:BINDING.sourceHash,next:s.next,active:s.active,reserved:s.reserved,known:s.known,stopped:s.stopped,overrun:s.overrun,attempts:s.attempts.map(a=>({scenarioId:a.scenarioId,dispatchIdentity:a.dispatchIdentity,state:a.state,slotReleased:a.slotReleased,k:a.k,known:a.known,attachment:a.attachment}))};
}});
