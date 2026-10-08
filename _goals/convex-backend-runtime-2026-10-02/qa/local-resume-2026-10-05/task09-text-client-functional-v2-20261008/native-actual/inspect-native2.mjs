import {openOwnedContext} from './common.mjs';
const c=await openOwnedContext();try{
 const s=await c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});await c.publish('native2-inspection-state',s);
 console.log(JSON.stringify({executions:s.runtimeAgentExecutions,models:s.runtimeModelOperations,attempts:s.runtimeModelAttempts}));
 const run=s.runtimeRuns.find(x=>x.clientRequestId?.includes('task09-tail-a'));const actual=s.runtimeRuns[0];
 if(actual){const out=await c.owner.query('runtimeAgent:reconcile',{memorySpaceId:c.memorySpaceId,runId:actual.runId}).catch(e=>({error:c.publicError(e)}));console.log(JSON.stringify({readOnlyReconcileQueryNotMutation:out}));}
}finally{await c.close();}
