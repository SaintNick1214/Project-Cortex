/** Narrow owned native extension controls. No arbitrary table/payload dispatcher. */
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import type { Id } from "./_generated/dataModel";
async function owned(ctx:MutationCtx,run:string,attemptId:Id<"runtimeModelAttempts">){
 if(!/^admission-[a-f0-9]{32}$/.test(run))throw Error("QA_OWNERSHIP_REJECTED");
 const attempt=await ctx.db.get("runtimeModelAttempts",attemptId);if(!attempt)throw Error("QA_UNOWNED");
 const operation=await ctx.db.get("runtimeModelOperations",attempt.operationDocumentId);if(!operation?.tenantId.startsWith(run+"-"))throw Error("QA_UNOWNED");
 return{attempt,operation};
}
export const revokeOrigin=internalMutation({args:{run:v.string(),reference:runtimeAuthorityReference,attemptId:v.id("runtimeModelAttempts")},handler:async(ctx,args)=>{
 const {operation}=await owned(ctx,args.run,args.attemptId);if(operation.reference.grantId!==args.reference.grantId||operation.tenantId!==args.reference.tenantId)throw Error("QA_UNOWNED");
 const id=ctx.db.normalizeId("runtimeAuthGrants",args.reference.grantId);if(!id)throw Error("QA_BAD_ID");const grant=await ctx.db.get("runtimeAuthGrants",id);if(grant?.tenantId!==operation.tenantId)throw Error("QA_UNOWNED");await ctx.db.patch("runtimeAuthGrants",id,{revokedAt:Date.now()});return{changed:true};
}});
export const renewOrigin=internalMutation({args:{run:v.string(),reference:runtimeAuthorityReference,attemptId:v.id("runtimeModelAttempts")},handler:async(ctx,args)=>{
 const {operation}=await owned(ctx,args.run,args.attemptId);if(operation.reference.grantId!==args.reference.grantId||operation.tenantId!==args.reference.tenantId)throw Error("QA_UNOWNED");
 const id=ctx.db.normalizeId("runtimeAuthGrants",args.reference.grantId);if(!id)throw Error("QA_BAD_ID");const grant=await ctx.db.get("runtimeAuthGrants",id);if(grant?.tenantId!==operation.tenantId||grant.version!==args.reference.grantVersion)throw Error("QA_UNOWNED");await ctx.db.patch("runtimeAuthGrants",id,{revokedAt:undefined});return{changed:true};
}});
export const partialMarker=internalMutation({args:{run:v.string(),attemptId:v.id("runtimeModelAttempts"),variant:v.union(v.literal("hashOnly"),v.literal("stateOnly"),v.literal("initial-model-pending"),v.literal("initial-model-attached"),v.literal("initial-token-pending"),v.literal("initial-token-attached"),v.literal("final-model-pending"),v.literal("final-model-attached"),v.literal("final-token-pending"),v.literal("final-token-attached"),v.literal("attempt-only-pending"),v.literal("attempt-only-attached"))},handler:async(ctx,args)=>{
 const {attempt,operation}=await owned(ctx,args.run,args.attemptId);
 if(args.variant!=="hashOnly"&&args.variant!=="stateOnly"){
  if(attempt.state!=="settled"||attempt.settledCostUnits!==40||attempt.reservationUnits!==100||attempt.checkpointAt===undefined||!attempt.slotReleased||!attempt.terminalEvidenceCanonical||!attempt.terminalEvidenceHash||!attempt.receiptCanonical)throw Error("QA_DEFENSIVE_PRECONDITION");
  const snapshot=JSON.parse(attempt.snapshotCanonical) as {modelId:string;nativeInterface:string};
  const tenant=await ctx.db.get("runtimeBudgetAccounts",attempt.tenantAccountId),run=await ctx.db.get("runtimeBudgetAccounts",attempt.runAccountId);
  if(!tenant||!run||tenant.tenantId!==operation.tenantId||run.tenantId!==operation.tenantId||tenant.activeConcurrency!==0||run.activeConcurrency!==0||tenant.reservedUnits!==0||run.reservedUnits!==0||tenant.uncertainUnits!==0||run.uncertainUnits!==0||tenant.settledUnits!==40||run.settledUnits!==40||operation.reservedUnits!==0||operation.uncertainUnits!==0||operation.settledUnits!==40)throw Error("QA_DEFENSIVE_BINDINGS");
  const grantId=ctx.db.normalizeId("runtimeAuthGrants",operation.reference.grantId);if(!grantId)throw Error("QA_UNOWNED");const grant=await ctx.db.get("runtimeAuthGrants",grantId);
  if(!grant||grant.tenantId!==operation.tenantId||grant.version!==operation.reference.grantVersion||grant.revokedAt!==undefined||grant.expiresAt!==undefined&&grant.expiresAt<=Date.now())throw Error("QA_DEFENSIVE_AUTHORITY");
  const current=JSON.parse(attempt.terminalEvidenceCanonical) as Record<string,unknown>;
  if(current.version!==1||current.dispatchIdentity!==attempt.dispatchIdentity||current.modelId!==snapshot.modelId||current.nativeInterface!==snapshot.nativeInterface||current.proof!=="provider-terminal-v1"||current.costSource!=="gateway-aggregate-usd-v1"||current.aggregateCostUsd!=="0.000040")throw Error("QA_DEFENSIVE_RECEIPT");
  // Finite values are derived from this owned snapshot. No caller data/patch/model/canonical dispatcher.
  const healthy={...current,actualModel:snapshot.modelId,usage:{inputTokens:attempt.measuredInputTokens,outputTokens:attempt.maximumOutputTokens}};
  const violated={...healthy,...(args.variant.includes("model")?{actualModel:"qualification/drift-model"}:args.variant.includes("token")?{usage:{inputTokens:attempt.measuredInputTokens+1,outputTokens:attempt.maximumOutputTokens+1}}:{})};
  const initial=canonicalModelJson(args.variant.startsWith("initial-")?violated:healthy),final=canonicalModelJson(args.variant.startsWith("final-")?violated:healthy);
  const initialHash=await semanticHash(initial),attachment=args.variant.endsWith("attached")?"attached" as const:"pending" as const;
  await ctx.db.patch("runtimeModelOperations",operation._id,{overrun:false});for(const account of [tenant,run])await ctx.db.patch("runtimeBudgetAccounts",account._id,{overrun:false});
  await ctx.db.patch("runtimeModelAttempts",attempt._id,{terminalEvidenceCanonical:initial,terminalEvidenceHash:initialHash,receiptCanonical:final,actualModel:args.variant.startsWith("attempt-only-")?"qualification/drift-model":snapshot.modelId,resultAttachmentState:attachment,resultWithheld:false,outputVisible:true,privateResultCanonical:canonicalModelJson({text:"answer"})});
  const hash=initialHash;
  return{changed:true,evidenceId:await semanticHash(canonicalModelJson(["native-terminal-evidence-v1",attempt._id,attempt.dispatchIdentity,initial,hash])),variant:args.variant};
 }
 if(attempt.terminalEvidenceHash!==undefined||attempt.resultAttachmentState!==undefined||attempt.state!=="dispatch_pending")throw Error("QA_MARKER_PRECONDITION");
 if(args.variant==="hashOnly")await ctx.db.patch("runtimeModelAttempts",attempt._id,{terminalEvidenceHash:"a".repeat(64)});else await ctx.db.patch("runtimeModelAttempts",attempt._id,{resultAttachmentState:"pending"});return{changed:true};
}});
export const parentRefinementRollback=internalMutation({args:{run:v.string(),attemptId:v.id("runtimeModelAttempts"),dispatchIdentity:v.string(),receiptCanonical:v.string()},handler:async(ctx,args)=>{
 await owned(ctx,args.run,args.attemptId);
 const result=await ctx.runMutation(makeFunctionReference<"mutation",{attemptId:Id<"runtimeModelAttempts">;dispatchIdentity:string;receiptCanonical:string},{evidenceId:string;state:string;settledCostUnits?:number;overrun:boolean}>("runtimeModelPolicy:captureTerminalEvidence"),{attemptId:args.attemptId,dispatchIdentity:args.dispatchIdentity,receiptCanonical:args.receiptCanonical});
 if(result.state!=="settled"||result.settledCostUnits!==150||!result.overrun)throw Error("QA_REFINEMENT_NOT_OBSERVED");
 throw new ConvexError({version:1,code:"QA_ROLLBACK",message:"Expected native refinement rollback",retryable:false,outcome:"rolled_back"});
}});
