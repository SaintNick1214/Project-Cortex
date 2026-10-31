/** Actual managed additions: current native authority, empty trust root, and absent native IDs.
 * These are safe functionality/visibility controls, never billable model-function acceptance. */
import assert from 'node:assert/strict';
import { argumentsFor } from './argument-candidates.mjs';
export async function preparePolicyDelta(ctx){
 const before=await ctx.snapshot();const ids=await ctx.operator('qualificationDelta:allocateDeletedAttemptId',{run:ctx.run,reference:ctx.references.reader});assert.equal(ids.transientCreated,3);assert.equal(ids.transientDeleted,3);assert.equal(ids.persistedRows,0);
 ctx.policyWitnesses=Object.fromEntries(Object.entries(ids).filter(([table])=>table.startsWith('runtime')));assert.deepEqual(Object.keys(ctx.policyWitnesses).sort(),['runtimeBudgetAccounts','runtimeModelAttempts','runtimeModelOperations']);assert.deepEqual(await ctx.snapshot(),before);
 const reference=ctx.references.reader;const grant=(await ctx.seed([{table:'runtimeAuthGrants',value:{principalId:ctx.principals.reader,membershipId:reference.membershipId,tenantId:ctx.scopes.tenantId,tenantEpoch:1,capabilities:['admin'],resourceAccess:'tenant',version:1,createdAt:Date.now()}}]))[0].id;
 ctx.references.policyAdmin={principalId:reference.principalId,principalVersion:1,membershipId:reference.membershipId,membershipVersion:1,grantId:grant,grantVersion:1,tenantId:reference.tenantId,tenantEpoch:1};
}
export async function qualifyPolicyDelta(ctx,ledger,observe){
 const rows=ledger.cases.filter(row=>row.group==='model-policy-delta');assert.equal(rows.length,16);assert.ok(rows.every(row=>row.visibility==='internal'));
 const healthyBefore=await ctx.snapshot();const healthy=await ctx.operator('runtimeAuth:recheck',{reference:ctx.references.reader,requirement:{capability:'run',tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId}});assert.equal(healthy.principalId,ctx.principals.reader);assert.equal(healthy.tenantId,ctx.scopes.tenantId);assert.equal(healthy.memorySpaceId,ctx.scopes.memorySpaceId);
 const tenantHealthy=await ctx.operator('runtimeAuth:recheck',{reference:ctx.references.policyAdmin,requirement:{capability:'admin',tenantId:ctx.scopes.tenantId}});assert.equal(tenantHealthy.resourceAccess,'tenant');assert.equal(tenantHealthy.memorySpaceId,undefined);assert.deepEqual(await ctx.snapshot(),healthyBefore);
 observe({id:'policy-delta:current-authority-controls',paths:['runtimeAuth:recheck'],phase:'current-policy-authority',identityAlias:'trustedOperator',expectedCode:'CURRENT_SCOPE_AND_TENANT_ADMIN',observedCode:'CURRENT_SCOPE_AND_TENANT_ADMIN',status:'PASS',noEffect:true});
 for(const row of rows){
  const args=argumentsFor(row,ctx);if(Object.hasOwn(args,'reference'))args.reference=ctx.references.reader;if(Object.hasOwn(args,'operationKey'))args.operationKey='agent.respond';if(Object.hasOwn(args,'runBudgetId'))args.runBudgetId=ctx.run+':absent-run';if(Object.hasOwn(args,'requestCanonical'))args.requestCanonical='{}';if(Object.hasOwn(args,'receiptCanonical'))args.receiptCanonical='{}';if(Object.hasOwn(args,'privateResultCanonical'))args.privateResultCanonical='{}';if(Object.hasOwn(args,'manifestId'))args.manifestId=ctx.run+':uninstalled-manifest';if(Object.hasOwn(args,'expectedRevision'))args.expectedRevision=1;
  if(row.path==='runtimeModelPolicy:provisionTenantPolicy'){args.reference=ctx.references.policyAdmin;args.policyCanonical=JSON.stringify({policyId:ctx.run+':tenant-policy',rules:{},scope:'tenant',tenantId:ctx.scopes.tenantId,version:1});}
  const code=['ensureBudget','installDeploymentPolicy','provisionTenantPolicy'].includes(row.path.split(':')[1])?'CAPABILITY_UNAVAILABLE':'FORBIDDEN';
  const item={id:'policy-delta:no-effect:'+row.path,paths:[row.path],phase:'current-policy-safe-control',identityAlias:'trustedOperator',expectedCode:code};observe({...item,phase:'current-policy-control-begin',status:'OBSERVED'});
  const before=await ctx.snapshot();let result,error;try{result=await ctx.operator(row.path,args);}catch(caught){error=caught;}
  assert.equal(result,undefined);assert.ok(error);assert.deepEqual(error.data,{version:1,code,message:'Model operation control failed.',retryable:false,outcome:'not_dispatched'});assert.deepEqual(await ctx.snapshot(),before);observe({...item,observedCode:code,status:'PASS',noEffect:true});
 }
 // Real revoked current grant, not a claims-only negative or platform visibility denial.
 const before=await ctx.snapshot();let error;try{await ctx.operator('runtimeModelPolicy:ensureBudget',{reference:ctx.references.revoked,operationKey:'agent.respond',requestId:ctx.run+':revoked-request',requestCanonical:'{}'});}catch(caught){error=caught;}
 assert.deepEqual(error?.data,{version:1,code:'FORBIDDEN',message:'Access denied',retryable:false,outcome:'not_dispatched'});assert.deepEqual(await ctx.snapshot(),before);
 observe({id:'policy-delta:revoked-current-grant',paths:['runtimeModelPolicy:ensureBudget'],phase:'current-policy-revocation',identityAlias:'trustedOperator',expectedCode:'FORBIDDEN',observedCode:'FORBIDDEN',status:'PASS',noEffect:true});
 return {nativeControls:16,healthyAuthorityControls:2,revokedNoEffectControls:1};
}
