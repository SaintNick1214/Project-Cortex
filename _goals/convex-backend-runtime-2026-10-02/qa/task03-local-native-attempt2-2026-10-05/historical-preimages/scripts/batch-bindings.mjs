import assert from 'node:assert/strict';
const bindings=new WeakMap();
export function admitBatchRow(ctx,table,row){
 assert.ok(['facts','memories'].includes(table));assert.ok(row&&typeof row==='object');
 const key=table==='facts'?'factId':'memoryId',logicalId=ctx.run+':'+table+'-owned';
 assert.equal(row[key],logicalId);assert.equal(row.tenantId,ctx.scopes.tenantId);assert.equal(row.memorySpaceId,ctx.scopes.memorySpaceId);assert.equal(row.ownerPrincipalId,ctx.principals.reader);
 assert.equal(typeof row._id,'string');assert.ok(ctx.refs.some(ref=>ref.table===table&&ref.id===row._id),'Reader getter must match tracked seeded row');
 const sourceId='manual:'+JSON.stringify([ctx.scopes.tenantId,ctx.scopes.memorySpaceId,table==='facts'?'fact':'memory',logicalId]);
 assert.equal(row.lineage?.sourceId,sourceId);assert.equal(row.lineage?.sourceEventId,sourceId);assert.equal(row.lineage?.sourceRevision,1);
 const map=bindings.get(ctx)??new Map();map.set(table,Object.freeze({logicalId,tenantId:row.tenantId,memorySpaceId:row.memorySpaceId,ownerPrincipalId:row.ownerPrincipalId,id:row._id}));bindings.set(ctx,map);
}
export function batchTarget(ctx,table){
 const binding=bindings.get(ctx)?.get(table);assert.ok(binding,'Healthy reader batch fixture has not been qualified');
 assert.equal(binding.tenantId,ctx.scopes.tenantId);assert.equal(binding.memorySpaceId,ctx.scopes.memorySpaceId);assert.equal(binding.ownerPrincipalId,ctx.principals.reader);assert.ok(ctx.refs.some(ref=>ref.table===table&&ref.id===binding.id));return binding.logicalId;
}
export async function qualifyBatchTargets(ctx){
 const before=await ctx.snapshot();const controls=[];
 for(const table of ['facts','memories']){const key=table==='facts'?'factId':'memoryId';const row=await ctx.call('reader',table+':get',{memorySpaceId:ctx.scopes.memorySpaceId,[key]:ctx.run+':'+table+'-owned'});admitBatchRow(ctx,table,row);controls.push({id:'batch-fixture:'+table+':reader-owned',paths:[table+':get'],phase:'healthy-batch-fixture',identityAlias:'reader',expectedCode:'OWNED_FIXTURE_BOUND',observedCode:'OWNED_FIXTURE_BOUND',status:'PASS',noEffect:true});}
 assert.deepEqual(await ctx.snapshot(),before);return controls;
}
