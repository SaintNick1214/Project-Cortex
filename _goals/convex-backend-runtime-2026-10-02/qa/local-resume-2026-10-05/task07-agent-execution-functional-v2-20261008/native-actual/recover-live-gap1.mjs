import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {join} from 'node:path';
import {openOwnedContext,q} from './common.mjs';
const c=await openOwnedContext();try{
 await c.verifyTarget('live-gap-recovery-target-verified1');const run=JSON.parse(await readFile(join(q,'live-submit.json'),'utf8')).result;
 const scope={tenantId:c.tenantId,memorySpaceId:c.memorySpaceId,runId:run.runId},args={memorySpaceId:c.memorySpaceId,runId:run.runId};
 const before=await c.admin.query('agentQualification:state',scope);assert.equal(before.executions[0].state,'unknown');assert.equal(before.ingestion.length,0);
 const first=await c.owner.mutation('runtimeAgent:reconcile',args);const after=await c.admin.query('agentQualification:state',scope);
 const second=await c.owner.mutation('runtimeAgent:reconcile',args);const final=await c.admin.query('agentQualification:state',scope);
 const output=await c.owner.query('runtimeAgent:observe',{...args,limit:100,finalOnly:true});
 assert.equal(after.ingestion.length,1);assert.equal(final.ingestion.length,1);assert.equal(first.receiptId,second.receiptId);
 assert.equal(final.run.responseStatus,'complete');assert.equal(final.modelAttempts.length,before.modelAttempts.length);
 assert.deepEqual(final.run.outputMessageIds,after.run.outputMessageIds);assert.ok(output.parts.some(row=>row.part.type==='text'&&row.part.text.includes('CORTEX_AGENT_TOOL_STREAM_OK')));
 await c.publish('live-gap-recovery1',{status:'PASS',first,second,before,after,final,output,providerAttemptsUnchanged:true,paidRetry:false,
  triggeringProductFailure:'live-native-failure-logs1.json',claimsOriginalLiveRunGreen:false});
} catch(e){await c.publish('live-gap-recovery1',{status:'FAIL',error:c.publicError(e)});throw e;}finally{await c.close();}
