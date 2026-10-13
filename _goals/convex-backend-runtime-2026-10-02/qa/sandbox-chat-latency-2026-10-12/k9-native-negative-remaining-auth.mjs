import assert from 'node:assert/strict';
import { context, write, errorSummary, hash, id } from './k9-native-negative-common.mjs';
const c=await context(), cases=[];
try {
 await c.verify(); const before=await c.snapshot(), owner=c.sdk('owner');
 const current=await owner.client.session(), [run]=(await c.table('runtimeRuns')).filter(row=>row.runId==='run:fce4d077e2f818285553969d4d7d09d5423f60c01630343521bcb8865557d015'); assert.ok(run);
 const handle={version:1,tenantId:current.tenantId,memorySpaceId:current.memorySpaceId,principalId:current.principalId,runId:run.runId,conversationId:run.conversationId,agentId:run.agentId,agentVersion:run.agentVersion,definitionHash:run.definitionHash};
 for(const [name,jwt] of [['invalid signature',(()=>{const p=c.token('owner').split('.');p[2]=(p[2][0]==='A'?'B':'A')+p[2].slice(1);return p.join('.');})()],['missing JWT',null]]){
  await c.verify();const client=c.sdk('owner',{jwt});let delivered=false,error,verdict='PASS';
  try {await client.client.observe(handle);delivered=true;}catch(e){error=errorSummary(e);}
  try {assert.equal(delivered,false,name+' must deny');assert.equal(error?.code,'UNAUTHENTICATED',name);}catch(e){verdict='FAIL';}
  const after=await c.snapshot();assert.deepEqual(after.counts,before.counts);assert.deepEqual(after.hashes,before.hashes);assert.deepEqual(after.financial,before.financial);
  cases.push({name,verdict,denied:!delivered,expectedCode:'UNAUTHENTICATED',observed:error,rpcs:client.events.filter(e=>e.phase==='rpc.begin').map(e=>e.method),noNewRunsOrEffects:true});await client.close();
 }
 await owner.close();const after=await c.snapshot();
 const receipt=await write('remaining-auth-outcomes',{observedAt:new Date().toISOString(),target:{sessionId:id,...c.s.target},sdk:c.sdkIdentity,cases,before:{counts:before.counts,hashes:before.hashes,financial:before.financial},after:{counts:after.counts,hashes:after.hashes,financial:after.financial},paidCalls:0,eachClassExecutedOnce:true,noExpiredRetry:true,noEarlierSevenRerun:true,freshVerifications:c.verifications()});
 console.log(JSON.stringify({receipt,cases:cases.map(x=>({name:x.name,verdict:x.verdict,denied:x.denied,code:x.observed?.code})),paidCalls:0}));if(cases.some(x=>x.verdict==='FAIL'))process.exitCode=1;
}catch(error){await write('remaining-auth-failure',{observedAt:new Date().toISOString(),error:errorSummary(error),completedCases:cases,paidCalls:0});process.exitCode=1;console.log(JSON.stringify({failed:true,error:errorSummary(error)}));}finally{await c.close();}
