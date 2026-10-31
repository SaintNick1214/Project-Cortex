/** Real Convex1.46/convex-test0.0.61 and Agent0.7.3; no network/provider/inference. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {getFunctionName} from 'convex/server';
import {v} from 'convex/values';
import {defineTestApp} from './cloud-v6-native-scratch/node_modules/convex-test/dist/index.js';
const R='/Users/SaintNick/Documents/Cortex/worktrees/backend-runtime-completion';
const Q=path.dirname(fileURLToPath(import.meta.url));
const schema=(await import(pathToFileURL(path.join(R,'convex-dev/schema.ts')))).default;
const agent=await import(pathToFileURL(path.join(R,'convex-dev/runtimeAgent.ts')));
const definitions=await import(pathToFileURL(path.join(R,'convex-dev/agentDefinitions.ts')));
const root=(await import(pathToFileURL(path.join(R,'convex-dev/runtimeGatewayMediaQualifications.ts')))).OBSERVED_GATEWAY_POLICY_MANIFEST_V18;
const modules={};
for(const name of ['runtimeAuth','runtimeMemory','runtimeMemoryContext','runtimeModelPolicy','runtimeIngestion','runtimeTranscript','runtimeContentJobs','runs','agentDefinitions']) modules[name]=await import(pathToFileURL(path.join(R,'convex-dev',name+'.ts')));
const app=defineTestApp({schema}); let actionCalls=0, preflightStops=0;
// Only the Action native-port response is interrupted. The registered product
// Action, native preparation, interruption and scheduler still execute.
modules.runtimeAgent={...agent,executeDirectV6:app.internalAction({args:(await import(pathToFileURL(path.join(R,'convex-dev/runtimeAgentSchema.ts')))).agentAttempt,handler:async(ctx,args)=>{
 actionCalls++;const native={...ctx,runMutation:async(ref,input)=>{const value=await ctx.runMutation(ref,input);if(getFunctionName(ref)==='runtimeAgent:prepareDirectTurn'){preflightStops++;throw Error('CONTROLLED_BEFORE_BILLABLE_DISPATCH');}return value;}};
 return await agent.executeDirectV6._handler(native,args);
}})};
let heldBackground=0;
modules.test={hold:app.internalMutation({args:{},handler:async()=>null}),submit:app.mutation({args:{request:v.any()},handler:async(ctx,args)=>{
 const port={...ctx,scheduler:{...ctx.scheduler,runAfter:async()=>{heldBackground++;return await ctx.scheduler.runAfter(86_400_000,defined.internal.test.hold,{});}}};
 return await modules.runs.submit._handler(port,args);
}})};
const defined=app.defineModules(modules),t=defined.createTest();
const cr=path.join(R,'node_modules/@convex-dev/agent/dist/component');
const cm=Object.fromEntries((await fs.readdir(cr,{recursive:true})).filter(x=>x.endsWith('.js')).map(x=>['./'+x,()=>import(pathToFileURL(path.join(cr,x)))]));
t.registerComponent('agent',(await import(pathToFileURL(path.join(cr,'schema.js')))).default,cm);
await t.mutation(defined.internal.runtimeModelPolicy.installDeploymentPolicy,{manifestId:root.manifestId,expectedRevision:root.revision});
const reference=await t.run(async(ctx)=>{const now=Date.now();const principalId=await ctx.db.insert('runtimeAuthPrincipals',{issuer:'https://controlled.test',subject:'owner',actorKind:'user',version:1,createdAt:now});const membershipId=await ctx.db.insert('runtimeAuthMemberships',{principalId,tenantId:'tenant',version:1,createdAt:now});await ctx.db.insert('runtimeAuthScopes',{tenantId:'tenant',epoch:1,createdAt:now});await ctx.db.insert('runtimeAuthScopes',{tenantId:'tenant',memorySpaceId:'space',epoch:1,createdAt:now});const grantId=await ctx.db.insert('runtimeAuthGrants',{principalId,membershipId,tenantId:'tenant',memorySpaceId:'space',tenantEpoch:1,memorySpaceEpoch:1,version:1,capabilities:['read','write','run','admin'],resourceAccess:'own',createdAt:now});return {principalId,principalVersion:1,membershipId,membershipVersion:1,grantId,grantVersion:1,tenantId:'tenant',tenantEpoch:1,memorySpaceId:'space',memorySpaceEpoch:1};});
const owned=t.withIdentity({issuer:'https://controlled.test',subject:'owner'});
const published=await owned.mutation(defined.api.agentDefinitions.publishVersion,{memorySpaceId:'space',clientMutationId:'native-v6-definition',expectedPreviousVersion:0,definitionInput:{instructions:{text:'controlled instructions',promptVersion:'prompt-1'},tools:[],context:{handlerId:'cortex.transcript',handlerVersion:1,registryHash:await definitions.executableRegistryHash(),memoryMode:'indexed-plus-pending',requiredStages:[],maxContextTokens:16384},policies:[{policyId:'native-v6-agent',version:1,rules:{limits:{toolSteps:0}}}]}});
const request={version:1,agentId:published.agentId,agentVersion:published.version,clientRequestId:'native-v6-turn',parts:[{type:'text',text:'controlled native input'}]};
const run=await owned.mutation(defined.api.test.submit,{request});
const started=await owned.mutation(defined.api.runtimeAgent.start,{runId:run.runId});
assert.equal(started.state,'ready');
await new Promise(resolve=>setTimeout(resolve,20));await t.finishInProgressScheduledFunctions();
const rows=await t.run(async ctx=>({executions:await ctx.db.query('runtimeAgentExecutions').collect(),operations:await ctx.db.query('runtimeAgentOperations').collect(),attempts:await ctx.db.query('runtimeModelAttempts').collect(),jobs:await ctx.db.system.query('_scheduled_functions').collect()}));
assert.equal(rows.executions.length,1);assert.equal(rows.executions[0].executionMode,'direct-v6');assert.equal(actionCalls,1);assert.equal(preflightStops,1);assert.equal(rows.executions[0].state,'unknown');assert.equal(rows.attempts.length,0);
const job=rows.jobs.find(x=>x._id===rows.executions[0].scheduledActionId);assert.equal(job.state.kind,'failed');
await owned.mutation(defined.api.runtimeAgent.start,{runId:run.runId});await new Promise(resolve=>setTimeout(resolve,20));await t.finishInProgressScheduledFunctions();assert.equal(actionCalls,1);
const nativeChecks=[];
for(const fault of ['cancel','grant','transcript','lease','tombstone']) {
 const next=await owned.mutation(defined.api.test.submit,{request:{...request,clientRequestId:'native-v6-'+fault}});
 await owned.mutation(defined.api.runtimeAgent.start,{runId:next.runId});
 const originalStops=preflightStops;
 const execution=await t.run(ctx=>ctx.db.query('runtimeAgentExecutions').withIndex('by_attempt',q=>q.eq('tenantId','tenant').eq('memorySpaceId','space').eq('runId',next.runId).eq('attemptNumber',1)).unique());
 if(fault==='cancel') await owned.mutation(defined.api.runtimeAgent.cancel,{runId:next.runId});
 else await t.run(async ctx=>{
  if(fault==='grant') await ctx.db.patch('runtimeAuthGrants',reference.grantId,{revokedAt:Date.now()});
  if(fault==='lease') {const outbox=await ctx.db.query('runtimeRunOutbox').withIndex('by_run',q=>q.eq('tenantId','tenant').eq('memorySpaceId','space').eq('runId',next.runId)).unique();await ctx.db.patch('runtimeRunOutbox',outbox._id,{leaseExpiresAt:Date.now()-1});}
  if(fault==='tombstone'){const conversation=await ctx.db.query('runtimeConversations').withIndex('by_scoped_id',q=>q.eq('tenantId','tenant').eq('memorySpaceId','space').eq('conversationId',next.conversationId)).unique();await ctx.db.patch('runtimeConversations',conversation._id,{tombstonedAt:Date.now()});}
  if(fault==='transcript'){const {agentComponent}=await import(pathToFileURL(path.join(R,'convex-dev/runtimeTranscript.ts')));await ctx.runMutation(agentComponent.messages.updateMessage,{messageId:next.inputMessageIds[0],patch:{message:{role:'user',content:'controlled current edit'}}});}
 });
 await new Promise(resolve=>setTimeout(resolve,20));await t.finishInProgressScheduledFunctions();
 const after=await t.run(async ctx=>({execution:await ctx.db.get('runtimeAgentExecutions',execution._id),attempts:await ctx.db.query('runtimeModelAttempts').collect(),job:await ctx.db.system.get('_scheduled_functions',execution.scheduledActionId)}));
 assert.equal(preflightStops,originalStops);assert.equal(after.attempts.length,0);assert.equal(after.execution.state,fault==='cancel'?'cancelled':'failed');
 if(fault==='grant') await t.run(ctx=>ctx.db.patch('runtimeAuthGrants',reference.grantId,{revokedAt:undefined}));
 nativeChecks.push({fault,executionState:after.execution.state,scheduledState:after.job.state.kind,providerAttempts:0});
}
// Actual parent rollback removes the scheduler record along with Core/component writes.
const rollbackRun=await owned.mutation(defined.api.test.submit,{request:{...request,clientRequestId:'native-v6-rollback'}});
const before=await t.run(async ctx=>({exec:await ctx.db.query('runtimeAgentExecutions').collect(),jobs:await ctx.db.system.query('_scheduled_functions').collect(),run:await ctx.db.query('runtimeRuns').withIndex('by_scoped_id',q=>q.eq('tenantId','tenant').eq('memorySpaceId','space').eq('runId',rollbackRun.runId)).unique()}));
await assert.rejects(owned.run(async ctx=>{await agent.start._handler(ctx,{runId:rollbackRun.runId});throw Error('CONTROLLED_PARENT_ROLLBACK');}),/CONTROLLED_PARENT_ROLLBACK/);
const afterRollback=await t.run(async ctx=>({exec:await ctx.db.query('runtimeAgentExecutions').collect(),jobs:await ctx.db.system.query('_scheduled_functions').collect(),run:await ctx.db.query('runtimeRuns').withIndex('by_scoped_id',q=>q.eq('tenantId','tenant').eq('memorySpaceId','space').eq('runId',rollbackRun.runId)).unique()}));assert.deepEqual(afterRollback,before);nativeChecks.push({fault:'atomic-parent-rollback',passed:true});
// Installed Agent starts save a pending canonical message AFTER contextHandler
// and BEFORE any model method. This is the concrete rejected prototype seam.
const orderingRun=await owned.mutation(defined.api.test.submit,{request:{...request,clientRequestId:'native-agent-ordering'}});
await owned.mutation(defined.api.runtimeAgent.start,{runId:orderingRun.runId});
const orderingExec=await t.run(ctx=>ctx.db.query('runtimeAgentExecutions').withIndex('by_attempt',q=>q.eq('tenantId','tenant').eq('memorySpaceId','space').eq('runId',orderingRun.runId).eq('attemptNumber',1)).unique());
await t.run(ctx=>ctx.scheduler.cancel(orderingExec.scheduledActionId));
const attempt={reference,runId:orderingRun.runId,attemptNumber:1,leaseVersion:orderingExec.leaseVersion};
await t.mutation(defined.internal.runtimeAgent.startContext,attempt);await t.mutation(defined.internal.runtimeAgent.saveContext,{...attempt,context:'',witnesses:[],completeness:'complete'});
const current=await t.query(defined.internal.runtimeAgent.hydrateExecution,attempt);
const {agentComponent}=await import(pathToFileURL(path.join(R,'convex-dev/runtimeTranscript.ts')));
const installedStart=(await import(pathToFileURL(path.join(R,'node_modules/@convex-dev/agent/dist/vercel/client/start.js')))).startGeneration;
let contextHooks=0,modelMethods=0;
const languageModel={specificationVersion:'v4',provider:'controlled',modelId:'controlled/no-model-call',doGenerate:async()=>{modelMethods++;throw Error('UNEXPECTED_MODEL');},doStream:async()=>{modelMethods++;throw Error('UNEXPECTED_MODEL');}};
const nativeMessages=()=>t.run(ctx=>ctx.runQuery(agentComponent.messages.listMessagesByThreadId,{threadId:current.threadId,order:'asc',paginationOpts:{numItems:100,cursor:null}}));
const prepare=async(preparedContext)=>await t.action(async ctx=>{
 const result=await installedStart(ctx,agentComponent,{promptMessageId:orderingRun.inputMessageIds[0],instructions:'controlled instructions'},
  {threadId:current.threadId,userId:reference.principalId,agentName:'controlled-native-ordering',languageModel,contextOptions:{recentMessages:0},storageOptions:{saveMessages:'promptAndOutput'},contextHandler:async()=>{contextHooks++;return preparedContext?current.messages:(await ctx.runQuery(defined.internal.runtimeAgent.hydrateExecution,attempt)).messages;}});
 await result.fail('CONTROLLED_PREPARATION_ONLY');return null;
});
const beforePositive=(await nativeMessages()).page.length;await prepare(false);const afterPositive=(await nativeMessages()).page.length;assert.equal(afterPositive,beforePositive+1);
await t.run(ctx=>ctx.db.patch('runtimeAuthGrants',reference.grantId,{revokedAt:Date.now()}));
const beforeDeny=(await nativeMessages()).page.length;await assert.rejects(prepare(false),/FORBIDDEN/);assert.equal((await nativeMessages()).page.length,beforeDeny);
// Private controlled prototype demonstrates the unsafe pending write while revoked;
// production now always keeps the fresh hook and this prototype is rejected.
await prepare(true);assert.equal((await nativeMessages()).page.length,beforeDeny+1);assert.equal(modelMethods,0);assert.equal(contextHooks,3);
await t.run(ctx=>ctx.db.patch('runtimeAuthGrants',reference.grantId,{revokedAt:undefined}));
nativeChecks.push({fault:'installed-agent-pre-storage-order',freshHookRevocationDeniedBeforePendingWrite:true,rejectedPreparedPrototypeAddedPendingMessage:true,modelMethods});
const receipt={passed:true,realInstalledAgentComponent:true,actualProductHandlers:['start','prepareDirectTurn','executeDirectV6','interruptDirect'],convex:'1.46.0',convexTest:'0.0.61',actionsExecuted:actionCalls,dispatchStops:preflightStops,nativeChecks,paidAttempts:rows.attempts.length,backgroundSchedulingPortHeld:heldBackground,executionState:rows.executions[0].state,scheduledState:job.state.kind,checks:['native atomic execution/scheduled-record identity','at-most-once Action failure no automatic retry','original direct interruption UNKNOWN','duplicate start no second Action'],limitations:'In-memory Convex/component transactions; no native OCC/cloud/latency result.'};
await fs.writeFile(path.join(Q,'cloud-v6-native-scheduler-'+(process.argv[2]??'v1')+'.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));process.exit(0);
