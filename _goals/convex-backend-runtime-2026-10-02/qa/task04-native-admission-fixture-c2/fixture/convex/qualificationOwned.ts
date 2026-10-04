/** Fixture operator controls only. Explicit owned cases; no arbitrary table/payload dispatcher. */
import { internalMutation, internalQuery } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { makeFunctionReference } from "convex/server";
import type { AdmitModelArgs } from "./runtimeModelPolicy";
import { ConvexError } from "convex/values";
import { runtimeAuthorityReference } from "./runtimeAuthSchema";
import { canonicalModelJson } from "../src/domain/model-policy";
import { semanticHash } from "../src/domain/profile";
import schema from "./schema";
import { syntheticManifest } from "./qualificationManifest";
import { bindTrustedBudget } from "./runtimeModelPolicy";
import type { RuntimeAuthorityReference } from "../src/auth/verified";
import type { TableNames } from "./_generated/dataModel";
const ownedTables = ["runtimeAuthPrincipals","runtimeAuthMemberships","runtimeAuthScopes","runtimeAuthGrants","runtimeAuthTombstones",
 "runtimeMemorySources","runtimeModelPolicies","runtimeModelQualifications","runtimeBudgetAccounts","runtimeModelOperations","runtimeModelAttempts","qaAdmissionPeerEffects"] as const;
function valid(run:string){if(!/^admission-[a-f0-9]{32}$/.test(run))throw new Error("QA_OWNERSHIP_REJECTED");}
function tenant(run:string,value:string){valid(run);if(!value.startsWith(run+"-"))throw new Error("QA_OWNERSHIP_REJECTED");}
async function rows(ctx:Pick<QueryCtx,"db">,run:string){valid(run);const result=[];
 for(const table of Object.keys(schema.tables) as TableNames[]){const selected=await ctx.db.query(table).take(321);if(selected.length>320)throw new Error("QA_ROW_CEILING");
  for(const row of selected)result.push({table,id:row._id,row});}
 if(result.length>320)throw new Error("QA_ROW_CEILING");return result;
}
export const seed=internalMutation({args:{run:v.string(),caseId:v.string(),subject:v.string()},handler:async(ctx,args)=>{
 valid(args.run);if(!/^[a-z][a-z0-9-]{1,64}$/.test(args.caseId)||!args.subject.startsWith(args.run+"-"))throw new Error("QA_OWNERSHIP_REJECTED");
 const tenantId=args.run+"-"+args.caseId,memorySpaceId=tenantId+"-space",now=Date.now();
 if((await ctx.db.query("runtimeAuthMemberships").take(321)).some(row=>row.tenantId===tenantId))throw new Error("QA_DUPLICATE_SEED");
 const principalId=await ctx.db.insert("runtimeAuthPrincipals",{issuer:"https://cortex-qualification.invalid",subject:args.subject,actorKind:"user",version:1,createdAt:now});
 const membershipId=await ctx.db.insert("runtimeAuthMemberships",{principalId,tenantId,version:1,createdAt:now});
 const tenantScopeId=await ctx.db.insert("runtimeAuthScopes",{tenantId,epoch:1,createdAt:now});const spaceScopeId=await ctx.db.insert("runtimeAuthScopes",{tenantId,memorySpaceId,epoch:1,createdAt:now});
 const grantId=await ctx.db.insert("runtimeAuthGrants",{principalId,membershipId,tenantId,memorySpaceId,tenantEpoch:1,memorySpaceEpoch:1,capabilities:["read","write","run","admin"],resourceAccess:"own",version:1,createdAt:now});
 const adminGrantId=await ctx.db.insert("runtimeAuthGrants",{principalId,membershipId,tenantId,tenantEpoch:1,capabilities:["admin"],resourceAccess:"tenant",version:1,createdAt:now});
 const reference:RuntimeAuthorityReference={principalId,principalVersion:1,membershipId,membershipVersion:1,grantId,grantVersion:1,tenantId,tenantEpoch:1,memorySpaceId,memorySpaceEpoch:1};
 const adminReference:RuntimeAuthorityReference={principalId,principalVersion:1,membershipId,membershipVersion:1,grantId:adminGrantId,grantVersion:1,tenantId,tenantEpoch:1};
 const content="hello",contentHash=await semanticHash(content),sourceId=tenantId+"-source",sourceEventId=tenantId+"-event";
 const sourceDocumentId=await ctx.db.insert("runtimeMemorySources",{tenantId,memorySpaceId,ownerPrincipalId:principalId,lineage:{sourceId,sourceEventId,sourceRevision:1,role:"user",trust:"user_assertion"},content,contentHash,createdAt:now});
 return {reference,adminReference,createdRefs:[{table:"runtimeAuthPrincipals",id:principalId},{table:"runtimeAuthMemberships",id:membershipId},{table:"runtimeAuthScopes",id:tenantScopeId},{table:"runtimeAuthScopes",id:spaceScopeId},{table:"runtimeAuthGrants",id:grantId},{table:"runtimeAuthGrants",id:adminGrantId},{table:"runtimeMemorySources",id:sourceDocumentId}],source:{sourceId,sourceEventId,sourceRevision:1,contentHash}};
}});
export const snapshot=internalQuery({args:{run:v.string()},handler:async(ctx,args)=>await rows(ctx,args.run)});
const fault=v.union(v.literal("grant-version"),v.literal("grant-expiry"),v.literal("principal-revoke"),v.literal("membership-revoke"),v.literal("tenant-delete"),v.literal("space-delete"),v.literal("scope-absence"),v.literal("source-edit"),v.literal("source-delete"),v.literal("parent-cancel"),v.literal("policy-revoke"),v.literal("qualification-revoke"),v.literal("identity-collision"),v.literal("corrupt-counter"),v.literal("agent-policy-revoke"));
export const change=internalMutation({args:{run:v.string(),reference:runtimeAuthorityReference,fault,operationId:v.optional(v.id("runtimeModelOperations")),attemptId:v.optional(v.id("runtimeModelAttempts"))},handler:async(ctx,args)=>{
 tenant(args.run,args.reference.tenantId);const now=Date.now();const reference=args.reference;const deletedRefs:Array<{table:TableNames;id:string}>=[];
 if(args.fault==="agent-policy-revoke"){const selected=await ctx.db.query("runtimeModelPolicies").withIndex("by_policy_version",q=>q.eq("policyId","qa-agent-policy").eq("version",1)).take(2);if(selected.length!==1||selected[0]!.tenantId!==reference.tenantId)throw new Error("QA_UNOWNED");await ctx.db.patch("runtimeModelPolicies",selected[0]!._id,{revokedAt:now});
 }else if(args.fault==="grant-version"||args.fault==="grant-expiry"){
  const id=ctx.db.normalizeId("runtimeAuthGrants",reference.grantId);if(!id)throw new Error("QA_BAD_ID");const row=await ctx.db.get("runtimeAuthGrants",id);if(!row||row.tenantId!==reference.tenantId)throw new Error("QA_UNOWNED");
  await ctx.db.patch("runtimeAuthGrants",id,args.fault==="grant-version"?{version:row.version+1}:{expiresAt:now});
 }else if(args.fault==="principal-revoke"){
  const id=ctx.db.normalizeId("runtimeAuthPrincipals",reference.principalId);if(!id)throw new Error("QA_BAD_ID");const row=await ctx.db.get("runtimeAuthPrincipals",id);if(!row||!row.subject.startsWith(args.run+"-"))throw new Error("QA_UNOWNED");await ctx.db.patch("runtimeAuthPrincipals",id,{revokedAt:now});
 }else if(args.fault==="membership-revoke"){
  const id=ctx.db.normalizeId("runtimeAuthMemberships",reference.membershipId);if(!id)throw new Error("QA_BAD_ID");const row=await ctx.db.get("runtimeAuthMemberships",id);if(!row||row.tenantId!==reference.tenantId)throw new Error("QA_UNOWNED");await ctx.db.patch("runtimeAuthMemberships",id,{revokedAt:now});
 }else if(["tenant-delete","space-delete","scope-absence"].includes(args.fault)){
  const scopes=await ctx.db.query("runtimeAuthScopes").withIndex("by_tenant_space",q=>q.eq("tenantId",reference.tenantId)).take(3);
  if(args.fault==="scope-absence"){for(const row of scopes){deletedRefs.push({table:"runtimeAuthScopes",id:row._id});await ctx.db.delete("runtimeAuthScopes",row._id);}}
  else {const space=args.fault==="space-delete";await ctx.db.insert("runtimeAuthTombstones",{tenantId:reference.tenantId,...(space?{memorySpaceId:reference.memorySpaceId!}:{}),resourceType:space?"memorySpace":"tenant",resourceId:space?reference.memorySpaceId!:reference.tenantId,deletedAt:now});}
 }else if(args.fault==="source-edit"||args.fault==="source-delete"){
  const sources=await ctx.db.query("runtimeMemorySources").withIndex("by_scope_source",q=>q.eq("tenantId",reference.tenantId).eq("memorySpaceId",reference.memorySpaceId!)).take(2);
  if(sources.length!==1)throw new Error("QA_SOURCE_AMBIGUOUS");const source=sources[0]!;
  await ctx.db.patch("runtimeMemorySources",source._id,args.fault==="source-edit"?{lineage:{...source.lineage,sourceRevision:2},content:"changed",contentHash:await semanticHash("changed")}:{tombstonedAt:now});
 }else if(args.fault==="parent-cancel"){
  if(!args.operationId)throw new Error("QA_BAD_ID");const row=await ctx.db.get("runtimeModelOperations",args.operationId);if(!row||row.tenantId!==reference.tenantId)throw new Error("QA_UNOWNED");await ctx.db.patch("runtimeModelOperations",row._id,{cancelled:true});
 }else if(args.fault==="policy-revoke"||args.fault==="qualification-revoke"){
  if(args.fault==="policy-revoke"){const selected=await ctx.db.query("runtimeModelPolicies").withIndex("by_scope_active",q=>q.eq("scope","deployment").eq("tenantId",undefined).eq("active",true)).take(2);for(const row of selected){if(row.root.manifestId!=="qa-task04-synthetic-v1")throw new Error("QA_UNOWNED");await ctx.db.patch("runtimeModelPolicies",row._id,{revokedAt:now});}}
  else {const selected=await ctx.db.query("runtimeModelQualifications").withIndex("by_receipt",q=>q.eq("receiptId","qa-chat").eq("version",1)).take(2);for(const row of selected){if(row.root.manifestId!=="qa-task04-synthetic-v1")throw new Error("QA_UNOWNED");await ctx.db.patch("runtimeModelQualifications",row._id,{revokedAt:now});}}
 }else if(args.fault==="identity-collision"){
  if(!args.attemptId)throw new Error("QA_BAD_ID");const row=await ctx.db.get("runtimeModelAttempts",args.attemptId);if(!row)throw new Error("QA_BAD_ID");const op=await ctx.db.get("runtimeModelOperations",row.operationDocumentId);if(op?.tenantId!==reference.tenantId)throw new Error("QA_UNOWNED");await ctx.db.patch("runtimeModelAttempts",row._id,{canonical:canonicalModelJson({forcedCollision:true})});
 }else if(args.fault==="corrupt-counter"){
  const accounts=await ctx.db.query("runtimeBudgetAccounts").take(321);for(const row of accounts)if(row.tenantId===reference.tenantId)await ctx.db.patch("runtimeBudgetAccounts",row._id,{reservedUnits:Number.MAX_SAFE_INTEGER});
 }
 return {changed:true,deletedRefs};
}});
export const parentRollback=internalMutation({args:{run:v.string(),reference:runtimeAuthorityReference},handler:async(ctx,args)=>{
 tenant(args.run,args.reference.tenantId);await ctx.db.insert("qaAdmissionPeerEffects",{run:args.run,dispatchDigest:"0".repeat(64),requestCount:0,effectCount:0,createdAt:Date.now(),marker:"rollback"});
 const bound=await bindTrustedBudget(ctx,{reference:args.reference,operationKey:"agent.respond",requestId:"parent-rollback",requestCanonical:canonicalModelJson({text:"hello"})});
 const request={semanticId:"parent-rollback",childCallId:"estimate",texts:["hello"],messages:[{role:"user",parts:[{type:"text",text:"hello"}]}],inputTokens:1,outputTokens:20,toolSteps:0,timeoutMs:1000,reservationUnits:1,promptVersion:"qa-prompt-1",schemaVersion:"qa-schema-1",extractionVersion:"qa-extract-1",toolRegistryVersion:"qa-tools-1",tools:[],options:{maxRetries:0}};
 const reserved=await ctx.runMutation(makeFunctionReference<"mutation",AdmitModelArgs,{status:string}>("runtimeModelPolicy:admit"),{reference:args.reference,operationKey:"agent.respond",runBudgetId:bound.runBudgetId,semanticId:"parent-rollback",ordinal:0,requestCanonical:canonicalModelJson(request)});
 if(reserved.status!=="reserved")throw new Error("QA_RESERVATION_NOT_OBSERVED");
 throw new ConvexError({version:1,code:"QA_ROLLBACK",message:"Expected fixture transaction rollback",retryable:false,outcome:"rolled_back"});
}});
function isOwned(run:string,table:TableNames,row:Record<string,unknown>):boolean{
 if(table==="runtimeAuthPrincipals")return typeof row.subject==="string"&&row.subject.startsWith(run+"-");
 if(table==="qaAdmissionPeerEffects")return row.run===run;
 if(table==="runtimeModelPolicies"||table==="runtimeModelQualifications")return (row.root as {manifestId?:string}|undefined)?.manifestId==="qa-task04-synthetic-v1";
 if(table==="runtimeModelAttempts")return false; // Link validation in cleanup below.
 return typeof row.tenantId==="string"&&row.tenantId.startsWith(run+"-");
}
export const cleanup=internalMutation({args:{run:v.string()},handler:async(ctx,args)=>{
 const all=await rows(ctx,args.run);const ownedOperations=new Set(all.filter(entry=>entry.table==="runtimeModelOperations"&&isOwned(args.run,entry.table,entry.row)).map(entry=>String(entry.id)));
 let deleted=0;const deletedRefs:Array<{table:TableNames;id:string}>=[];for(const table of (Object.keys(schema.tables) as TableNames[]).reverse())for(const entry of all.filter(entry=>entry.table===table)){
  if(isOwned(args.run,table,entry.row)||(table==="runtimeModelAttempts"&&ownedOperations.has(String((entry.row as {operationDocumentId?:string}).operationDocumentId)))){deletedRefs.push({table,id:entry.id});await ctx.db.delete(entry.id);deleted++;}
 }
 return {deleted,deletedRefs};
}});
/** Empty-registry negative uses EXACT phase-one stored payload/provenance, not malformed evidence. */
export const fabricateRoot=internalMutation({args:{run:v.string()},handler:async(ctx,args)=>{
 valid(args.run);const manifest=syntheticManifest,canonical=canonicalModelJson(manifest);
 const root={manifestId:manifest.manifestId,revision:manifest.revision,canonical,hash:await semanticHash(canonical),artifactRevision:manifest.artifactRevision,evidenceHash:manifest.evidenceHash,acceptanceHash:manifest.acceptanceHash};
 for(const policy of manifest.policies)await ctx.db.insert("runtimeModelPolicies",{policyId:policy.policyId,version:policy.version,scope:policy.scope==="agent"?"agent":"deployment",canonical:canonicalModelJson(policy),root,active:true,createdAt:Date.now(),...(policy.scope==="agent"?{tenantId:policy.tenantId!,agentId:policy.agentId!,agentVersion:policy.agentVersion!}:{}),...(policy.operationKey?{operationKey:policy.operationKey}:{})});
 for(const q of manifest.qualifications)await ctx.db.insert("runtimeModelQualifications",{receiptId:q.receiptId,version:manifest.revision,canonical:canonicalModelJson(q),root,active:true,createdAt:Date.now()});
 return {fabricated:true};
}});
