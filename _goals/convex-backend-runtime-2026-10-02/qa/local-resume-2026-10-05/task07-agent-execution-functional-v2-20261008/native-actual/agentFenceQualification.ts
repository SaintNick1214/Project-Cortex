/** Disposable-only actual fence probe. It calls the product handler unchanged;
 * errors are observed before native admission, never replaced with model results. */
import { internalAction } from './_generated/server';
import { v } from 'convex/values';
import { agentAttempt } from './runtimeAgentSchema';
import { modelStepHandler } from './runtimeAgent';
export const attemptModel=internalAction({args:{...agentAttempt,ordinal:v.number()},handler:async(ctx,args)=>{
  try { const result=await modelStepHandler(ctx,args); return {denied:false,result}; }
  catch(error) { return {denied:true,error:{name:error instanceof Error?error.name:'unknown',
    message:error instanceof Error?error.message:'unknown',data:typeof error==='object'&&error!==null&&'data' in error?error.data:null}}; }
}});

/** Test only the existing admitted lease deadline without waiting five minutes.
 * No model/tool result, authority, policy or billing row is created or altered. */
import { internalMutation } from './_generated/server';
export const expireFixtureLease=internalMutation({args:agentAttempt,handler:async(ctx,args)=>{
  const owned=await ctx.db.query('runtimeAgentExecutions').withIndex('by_attempt',q=>q.eq('tenantId',args.reference.tenantId)
    .eq('memorySpaceId',args.reference.memorySpaceId!).eq('runId',args.runId).eq('attemptNumber',args.attemptNumber)).unique();
  const outbox=await ctx.db.query('runtimeRunOutbox').withIndex('by_run',q=>q.eq('tenantId',args.reference.tenantId)
    .eq('memorySpaceId',args.reference.memorySpaceId!).eq('runId',args.runId)).unique();
  if(!owned||owned.state!=='waiting_approval'||owned.leaseVersion!==args.leaseVersion||!outbox||outbox.state!=='claimed'
    ||outbox.leaseVersion!==args.leaseVersion||outbox.leaseExpiresAt===undefined)throw new Error('NOT_EXACT_OWNED_WAITING_LEASE');
  const previous=outbox.leaseExpiresAt,leaseExpiresAt=Date.now()-1;
  await ctx.db.patch('runtimeRunOutbox',outbox._id,{leaseExpiresAt});
  return {previous,leaseExpiresAt,runId:args.runId,leaseVersion:args.leaseVersion,fixtureOnlyDeadlineAdjustment:true,noInference:true};
}});

/** Real owned Workflow id/lifetime, without a model or server-tool effect. */
import { WorkflowManager } from '@convex-dev/workflow';
import { components } from './_generated/api';
import { makeFunctionReference } from 'convex/server';
import type { FunctionReference } from 'convex/server';
import type { Infer } from 'convex/values';
import { runtimeAuthorityReference } from './runtimeAuthSchema';
import { currentRun } from './runs';
type Attempt={reference:Infer<typeof runtimeAuthorityReference>;runId:string;attemptNumber:number;leaseVersion:number};
const fixtureWorkflow=new WorkflowManager(components.workflow);
export const idleWorkflow=fixtureWorkflow.define({args:agentAttempt,returns:v.null(),handler:async(step)=>{
  await step.awaitEvent({name:'fixture-expiry-unblock'});return null;
}});
export const attachOwnedWorkflow=internalMutation({args:agentAttempt,handler:async(ctx,args)=>{
  await currentRun(ctx,args.reference,args.runId,'run');
  const owned=await ctx.db.query('runtimeAgentExecutions').withIndex('by_attempt',q=>q.eq('tenantId',args.reference.tenantId)
    .eq('memorySpaceId',args.reference.memorySpaceId!).eq('runId',args.runId).eq('attemptNumber',args.attemptNumber)).unique();
  if(!owned||owned.leaseVersion!==args.leaseVersion||owned.state!=='ready'||owned.workflowId)throw new Error('NOT_OWNED_READY_FIXTURE');
  const reference=makeFunctionReference<'mutation',{args:Attempt},string>('agentFenceQualification:idleWorkflow') as unknown as FunctionReference<'mutation','internal',{args:Attempt},string>;
  const workflowId=await fixtureWorkflow.start(ctx,reference,args,{startAsync:true});
  await ctx.db.patch('runtimeAgentExecutions',owned._id,{workflowId});return {workflowId,fixtureOnly:true,noModelOrToolExecution:true};
}});

import { internalQuery } from './_generated/server';
export const budgets=internalQuery({args:{tenantId:v.string(),memorySpaceId:v.string(),runId:v.string()},handler:async(ctx,args)=>{
  const run=await ctx.db.query('runtimeRuns').withIndex('by_scoped_id',q=>q.eq('tenantId',args.tenantId).eq('memorySpaceId',args.memorySpaceId).eq('runId',args.runId)).unique();
  if(!run)throw new Error('UNKNOWN_OWNED_FIXTURE_RUN');
  const account=await ctx.db.get('runtimeBudgetAccounts',run.runAccountId);
  if(!account||account.kind!=='run'||account.tenantId!==args.tenantId)throw new Error('WRONG_OWNED_RUN_ACCOUNT');
  const tenants=(await ctx.db.query('runtimeBudgetAccounts').collect()).filter(row=>row.tenantId===args.tenantId&&row.kind==='tenant'&&row.current);
  const project=(row:typeof account)=>({_id:row._id,kind:row.kind,runBudgetId:row.runBudgetId,cancelled:row.cancelled,reference:row.reference,
    root:{manifestId:row.root.manifestId,revision:row.root.revision},reservedUnits:row.reservedUnits,uncertainUnits:row.uncertainUnits,settledUnits:row.settledUnits,
    activeConcurrency:row.activeConcurrency,version:row.version});
  return {run:project(account),tenants:tenants.map(project)};
}});
