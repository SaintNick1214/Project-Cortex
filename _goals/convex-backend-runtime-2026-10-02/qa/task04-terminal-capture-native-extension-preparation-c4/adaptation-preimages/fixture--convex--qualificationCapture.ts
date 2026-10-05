/** Narrow owned native extension controls. No arbitrary table/payload dispatcher. */
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { makeFunctionReference } from "convex/server";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
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
export const partialMarker=internalMutation({args:{run:v.string(),attemptId:v.id("runtimeModelAttempts"),variant:v.union(v.literal("hashOnly"),v.literal("stateOnly"))},handler:async(ctx,args)=>{
 const {attempt}=await owned(ctx,args.run,args.attemptId);if(attempt.terminalEvidenceHash!==undefined||attempt.resultAttachmentState!==undefined||attempt.state!=="dispatch_pending")throw Error("QA_MARKER_PRECONDITION");
 if(args.variant==="hashOnly")await ctx.db.patch("runtimeModelAttempts",attempt._id,{terminalEvidenceHash:"a".repeat(64)});else await ctx.db.patch("runtimeModelAttempts",attempt._id,{resultAttachmentState:"pending"});return{changed:true};
}});
export const parentRefinementRollback=internalMutation({args:{run:v.string(),attemptId:v.id("runtimeModelAttempts"),dispatchIdentity:v.string(),receiptCanonical:v.string()},handler:async(ctx,args)=>{
 await owned(ctx,args.run,args.attemptId);
 const result=await ctx.runMutation(makeFunctionReference<"mutation",{attemptId:Id<"runtimeModelAttempts">;dispatchIdentity:string;receiptCanonical:string},{evidenceId:string;state:string;settledCostUnits?:number;overrun:boolean}>("runtimeModelPolicy:captureTerminalEvidence"),{attemptId:args.attemptId,dispatchIdentity:args.dispatchIdentity,receiptCanonical:args.receiptCanonical});
 if(result.state!=="settled"||result.settledCostUnits!==150||!result.overrun)throw Error("QA_REFINEMENT_NOT_OBSERVED");
 throw new ConvexError({version:1,code:"QA_ROLLBACK",message:"Expected native refinement rollback",retryable:false,outcome:"rolled_back"});
}});
