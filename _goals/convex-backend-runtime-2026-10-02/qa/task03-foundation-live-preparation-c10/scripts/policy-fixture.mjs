import assert from 'node:assert/strict';
export async function qualifyPolicyTemplate(ctx){
 const before=await ctx.snapshot();
 const policy=await ctx.call('reader','governance:getTemplate',{template:'GDPR',tenantId:ctx.scopes.tenantId,scope:{organizationId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId}});
 assert.ok(policy&&typeof policy==='object');assert.equal(policy.organizationId,ctx.scopes.tenantId);assert.equal(policy.memorySpaceId,ctx.scopes.memorySpaceId);assert.equal(policy.compliance?.mode,'GDPR');
 assert.match(policy.conversations?.retention?.deleteAfter,/^[1-9]\d*(?:s|m|h|d|w|y)$/);
 assert.deepEqual(await ctx.snapshot(),before);
 return {id:'governance:healthy-scoped-GDPR-template',paths:['governance:getTemplate'],phase:'healthy-policy-fixture',identityAlias:'reader',expectedCode:'SCOPED_TEMPLATE_VALID',observedCode:'SCOPED_TEMPLATE_VALID',status:'PASS',noEffect:true};
}
