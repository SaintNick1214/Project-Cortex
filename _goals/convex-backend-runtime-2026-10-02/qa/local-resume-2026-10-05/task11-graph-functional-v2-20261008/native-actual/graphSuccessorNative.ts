/** Disposable unpaid registered fixture: inject a genuine current dependency witness, never a model receipt. */
import {v, ConvexError} from 'convex/values';
import {makeFunctionReference} from 'convex/server';
import {internalMutation, internalQuery} from './_generated/server';
import {runtimeAuthorityReference} from './runtimeAuthSchema';
import {recheckAuthority} from './runtimeAuth';
const TENANT='task11-7c3504e9-96d6-48e9-9022-7d1e8f655226', SPACE=TENANT+'-space';
function own(value: {tenantId:string;memorySpaceId?:string}) {
  if(value.tenantId!==TENANT || value.memorySpaceId!==SPACE)throw new ConvexError('FIXTURE_SCOPE_DENIED');
}
export const attachDependency=internalMutation({args:{reference:runtimeAuthorityReference,
  upstreamSourceId:v.string(),dependentSourceId:v.string()},handler:async(ctx,args)=>{
  own(args.reference);
  if(args.upstreamSourceId===args.dependentSourceId)throw new ConvexError('FIXTURE_SELF_DEPENDENCY');
  const s={tenantId:TENANT,memorySpaceId:SPACE};
  const parent=await ctx.db.query('runtimeMemorySources').withIndex('by_scope_source',q=>q.eq('tenantId',TENANT)
    .eq('memorySpaceId',SPACE).eq('lineage.sourceId',args.upstreamSourceId)).unique();
  const dependent=await ctx.db.query('runtimeMemorySources').withIndex('by_scope_source',q=>q.eq('tenantId',TENANT)
    .eq('memorySpaceId',SPACE).eq('lineage.sourceId',args.dependentSourceId)).unique();
  if(!parent||!dependent||parent.tombstonedAt||dependent.tombstonedAt||dependent.contextSourceWitnesses?.length)
    throw new ConvexError('FIXTURE_DEPENDENCY_PRECONDITION');
  for(const source of [parent,dependent])await recheckAuthority(ctx,args.reference,{...s,capability:'write',
    resource:{...s,resourceType:'source',resourceId:source.lineage.sourceId,ownerPrincipalId:source.ownerPrincipalId}});
  const witness={sourceId:parent.lineage.sourceId,sourceEventId:parent.lineage.sourceEventId,
    sourceRevision:parent.lineage.sourceRevision,contentHash:parent.contentHash,permissions:['canViewFacts' as const]};
  await ctx.db.patch('runtimeMemorySources',dependent._id,{contextSourceWitnesses:[witness]});
  await ctx.runMutation(makeFunctionReference<'mutation'>('runtimeGraph:enqueue'),
    {reference:args.reference,sourceIds:[dependent.lineage.sourceId]});
  return {upstreamSourceId:parent.lineage.sourceId,dependentSourceId:dependent.lineage.sourceId,witness,
    setup:'unpaid fixture injection of current dependency; not a provider-derived tool result'};
}});
export const dependencies=internalQuery({args:{tenantId:v.string(),memorySpaceId:v.string()},handler:async(ctx,args)=>{
  own(args);return ctx.db.query('runtimeGraphDependencies').withIndex('by_upstream',q=>q.eq('tenantId',TENANT)
    .eq('memorySpaceId',SPACE)).collect();
}});
