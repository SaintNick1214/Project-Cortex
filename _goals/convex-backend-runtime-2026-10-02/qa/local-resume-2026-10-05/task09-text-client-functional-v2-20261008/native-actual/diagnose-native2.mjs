import {openOwnedContext} from './common.mjs';
const c=await openOwnedContext();try{
 const s=await c.admin.query('agentQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});
 await c.publish('native2-diagnostic-state',s);
 console.log(JSON.stringify({tables:Object.keys(s),runs:s.runtimeRuns?.map(r=>({runId:r.runId,state:r.responseStatus,failure:r.failureCode})),executions:s.runtimeAgentExecutions,operations:s.runtimeAgentOperations,models:s.runtimeModelOperations,attempts:s.runtimeModelAttempts}));
}finally{await c.close();}
