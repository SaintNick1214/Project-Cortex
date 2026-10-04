from pathlib import Path
p=Path('/workspace/Project-Cortex/_goals/convex-backend-runtime-2026-10-02/qa/task04-model-drift-native-extra-preparation-c3/fixture/convex/qualificationCapture.ts')
s=p.read_text();s=s.replace('import type { Id }','import { canonicalModelJson } from "../src/domain/model-policy";\nimport { semanticHash } from "../src/domain/profile";\nimport type { Id }')
variants=[f'{source}-{axis}-{state}' for source in ['initial','final'] for axis in ['model','token'] for state in ['pending','attached']]+['attempt-only-pending','attempt-only-attached','malformed-pending','hash-mismatch-pending']
s=s.replace('v.literal("stateOnly"))','v.literal("stateOnly"),'+','.join('v.literal("'+x+'")' for x in variants)+')')
old='const {attempt}=await owned(ctx,args.run,args.attemptId);if(attempt.terminalEvidenceHash'
new='''const {attempt,operation}=await owned(ctx,args.run,args.attemptId);
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
  await ctx.db.patch("runtimeModelAttempts",attempt._id,{terminalEvidenceCanonical:args.variant==="malformed-pending"?"{":initial,terminalEvidenceHash:args.variant==="hash-mismatch-pending"?"a".repeat(64):initialHash,receiptCanonical:final,actualModel:args.variant.startsWith("attempt-only-")?"qualification/drift-model":snapshot.modelId,resultAttachmentState:attachment,resultWithheld:false,outputVisible:true,privateResultCanonical:canonicalModelJson({text:"answer"})});
  const hash=args.variant==="hash-mismatch-pending"?"a".repeat(64):initialHash;
  return{changed:true,evidenceId:await semanticHash(canonicalModelJson(["terminal-evidence-v1",attempt._id,hash])),variant:args.variant};
 }
 if(attempt.terminalEvidenceHash'''
assert old in s;s=s.replace(old,new)
p.write_text(s)
