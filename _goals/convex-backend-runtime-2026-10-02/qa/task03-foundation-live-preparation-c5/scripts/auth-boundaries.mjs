import assert from 'node:assert/strict';
import { authDenial } from './native-engine.mjs';
const pause=ms=>new Promise(done=>setTimeout(done,ms));
async function deny(ctx,identity,path,args){const before=await ctx.snapshot();let result,error;try{result=await ctx.call(identity,path,args);}catch(caught){error=caught;}authDenial(result,error);assert.deepEqual(await ctx.snapshot(),before);}
export async function qualifyAuthorityBoundaries(ctx){
 const out=[],p=ctx.run+':authority-',scope={tenantId:ctx.scopes.tenantId,memorySpaceId:ctx.scopes.memorySpaceId},args={...scope,namespace:p+'baseline',key:p+'key'};
 await ctx.call('reader','mutable:set',{...args,value:51});await ctx.discoverOwnedEffects();assert.equal((await ctx.call('reader','mutable:get',args)).value,51);
 assert.equal((await ctx.call('reader','mutable:get',{namespace:args.namespace,key:args.key})).value,51);out.push('omitted-single-eligible-scope');
 await deny(ctx,'reader','mutable:get',{...args,tenantId:ctx.scopes.foreignTenantId});await deny(ctx,'reader','mutable:get',{...args,memorySpaceId:ctx.scopes.foreignMemorySpaceId});out.push('mismatched-tenant-space');
 await deny(ctx,'claimsOnly','mutable:get',args);out.push('claims-do-not-grant-authority');
 const altSpace=p+'second-space';await ctx.seed([{table:'runtimeAuthScopes',value:{tenantId:scope.tenantId,memorySpaceId:altSpace,epoch:1,createdAt:Date.now()}}]);
 await ctx.seed([{table:'runtimeAuthGrants',value:{principalId:ctx.principals.reader,membershipId:ctx.references.reader.membershipId,tenantId:scope.tenantId,memorySpaceId:altSpace,tenantEpoch:1,memorySpaceEpoch:1,capabilities:['read','write'],resourceAccess:'own',version:1,createdAt:Date.now()}}]);
 await deny(ctx,'reader','mutable:get',{namespace:args.namespace,key:args.key});assert.equal((await ctx.call('reader','mutable:get',args)).value,51);out.push('ambiguous-scope-explicit-selector');
 const altArgs={...args,memorySpaceId:altSpace,namespace:p+'alt'};await ctx.call('reader','mutable:set',{...altArgs,value:52});await ctx.discoverOwnedEffects();assert.equal((await ctx.call('reader','mutable:get',altArgs)).value,52);
 await ctx.operator('runtimeAuth:deleteScope',{tenantId:scope.tenantId,memorySpaceId:altSpace});await ctx.discoverOwnedEffects();await deny(ctx,'reader','mutable:get',altArgs);await deny(ctx,'reader','mutable:set',{...altArgs,value:53});out.push('scope-deletion-no-read-write-recreate');
 const otherMembership=(await ctx.seed([{table:'runtimeAuthMemberships',value:{principalId:ctx.principals.reader,tenantId:ctx.scopes.foreignTenantId,version:1,createdAt:Date.now()}}]))[0].id;
 await ctx.seed([{table:'runtimeAuthGrants',value:{principalId:ctx.principals.reader,membershipId:otherMembership,tenantId:ctx.scopes.foreignTenantId,memorySpaceId:ctx.scopes.foreignMemorySpaceId,tenantEpoch:1,memorySpaceEpoch:1,capabilities:['read','write'],resourceAccess:'own',version:1,createdAt:Date.now()}}]);
 await deny(ctx,'reader','mutable:get',{namespace:args.namespace,key:args.key});assert.equal((await ctx.call('reader','mutable:get',args)).value,51);out.push('ambiguous-membership-explicit-tenant');
 await ctx.operator('runtimeAuth:revokeMembership',{membershipId:otherMembership});
 const expirySpace=p+'expiry';await ctx.seed([{table:'runtimeAuthScopes',value:{tenantId:scope.tenantId,memorySpaceId:expirySpace,epoch:1,createdAt:Date.now()}}]);
 const expiresAt=Date.now()+6000;await ctx.seed([{table:'runtimeAuthGrants',value:{principalId:ctx.principals.writer,membershipId:ctx.references.writer.membershipId,tenantId:scope.tenantId,memorySpaceId:expirySpace,tenantEpoch:1,memorySpaceEpoch:1,capabilities:['write'],resourceAccess:'own',version:1,createdAt:Date.now(),expiresAt}}]);
 const expiryArgs={...args,memorySpaceId:expirySpace,namespace:p+'expiry'};const healthy=await ctx.call('writer','mutable:set',{...expiryArgs,value:61});assert.ok(healthy);await ctx.discoverOwnedEffects();
 const rows=await ctx.snapshot();assert.ok(rows.some(row=>row.table==='mutable'&&row.row?.namespace===expiryArgs.namespace&&row.row.value===61));
 const wait=expiresAt-Date.now()+100;if(wait>0){assert.ok(wait<=6100);await pause(wait);}await deny(ctx,'writer','mutable:set',{...expiryArgs,value:62});out.push('actual-grant-clock-expiry');
 const membershipArgs={...args,memorySpaceId:ctx.scopes.writerMemorySpaceId,namespace:p+'membership'};assert.ok(await ctx.call('writer','mutable:set',{...membershipArgs,value:71}));await ctx.discoverOwnedEffects();
 await ctx.operator('runtimeAuth:revokeMembership',{membershipId:ctx.references.writer.membershipId});await deny(ctx,'writer','mutable:set',{...membershipArgs,value:72});out.push('membership-revocation-no-later-effect');
 // Current membership schema has lifecycle/version but no expiry property. Never invent one.
 return out;
}
