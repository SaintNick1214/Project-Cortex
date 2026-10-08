import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,q} from './common.mjs';

const prior=JSON.parse(await readFile(join(q,'qualification2-generate.json'),'utf8'));
const context=await openOwnedContext(),reference=prior.args.reference,operation=prior.args.requestId.slice('task07-qualification-'.length),outcomes=[];
const tenantId=reference.tenantId,memorySpaceId=reference.memorySpaceId;
async function call(label,kind,name,args,client=context.admin){const began=Date.now();
  try{const result=await client[kind](name,args);await context.publish(label,{function:name,kind,args,result,elapsedMs:Date.now()-began,status:'PASS'});return result;}
  catch(error){await context.publish(label,{function:name,kind,args,error:context.publicError(error),elapsedMs:Date.now()-began,status:'FAIL'});throw error;}}
function assertComplete(value,expectedCount){
  assert.equal(value.error,null);assert.deepEqual(value.cleanupErrors,[]);assert.ok(value.result);
  assert.equal(value.after.attempts.length,expectedCount);
  for(const attempt of value.after.attempts){assert.equal(attempt.state,'uncertain');assert.equal(attempt.slotReleased,true);
    assert.equal(attempt.resultWithheld,false);assert.equal(attempt.reservationUnits,100000);assert.ok(attempt.privateResultBytes>0);
    assert.equal(attempt.receipt.costSource,'unavailable');assert.equal(attempt.receipt.outcome,'confirmed');
    assert.equal(attempt.receipt.actualModel,'openai/gpt-4o-mini');assert.ok(attempt.receipt.usage.inputTokens>0);}
  for(const op of value.after.operations){assert.equal(op.reservedUnits,0);assert.equal(op.uncertainUnits,100000);assert.equal(op.settledUnits,0);}
  for(const account of value.after.accounts){assert.equal(account.reservedUnits,0);assert.equal(account.uncertainUnits,expectedCount*100000);
    assert.equal(account.settledUnits,0);assert.equal(account.activeConcurrency,0);assert.equal(account.overrun,false);}
  const admit=value.events.find(event=>event.phase==='admit'&&event.status==='reserved');assert.ok(admit);
  assert.ok(admit.state.accounts.some(account=>account.reservedUnits===100000&&account.activeConcurrency===1));
  const terminal=value.events.find(event=>event.phase==='terminal');assert.ok(terminal);
  assert.ok(terminal.receipt.usage.inputTokens<=admit.inputBound);assert.ok(terminal.receipt.usage.outputTokens<=admit.outputBound);
  assert.ok(value.result.inputBound<=32768);assert.equal(value.result.featureEnvelope,'agent-tools-chat-v1');
}
function toolCall(value){const part=value.result.parts.find(part=>part.type==='tool-call');assert.ok(part);
  assert.equal(part.toolName,'memory_recall');const input=typeof part.input==='string'?JSON.parse(part.input):part.input;
  assert.deepEqual(input,{text:'jasmine tea',limit:1});assert.ok(part.toolCallId);
  return {toolCallId:part.toolCallId,toolName:part.toolName,input};}
async function replay(label,args,previous){const value=await call(label,'action','gatewayQualification:probe',args);
  assert.equal(value.error,null);assert.deepEqual(value.cleanupErrors,[]);assert.equal(value.result.replay,true);
  assert.deepEqual(value.after.attempts,previous.after.attempts);assert.deepEqual(value.after.accounts,previous.after.accounts);
  assert.deepEqual(value.after.operations,previous.after.operations);assert.equal(value.events.filter(event=>event.phase==='checkpoint').length,0);
  return value;}
try{
  await context.verifyTarget('qualification3-target-verified');
  const common={reference,requestId:prior.args.requestId};
  const persisted=await call('qualification3-first-generate-current-state','query','gatewayQualification:state',{reference,runBudgetId:prior.result.after.operations[0].runBudgetId});
  const generated={...prior.result,after:persisted};
  assertComplete(generated,1);toolCall(generated);await replay('qualification3-generate-replay',{...common,mode:'generate'},generated);
  outcomes.push({name:'native generate returns a qualified fixed tool call; replay adds no dispatch and retains full liability',status:'PASS'});
  const streamed=await call('qualification3-tool-stream','action','gatewayQualification:probe',{...common,mode:'tool'});
  assertComplete(streamed,2);const callResult=toolCall(streamed);await replay('qualification3-tool-stream-replay',{...common,mode:'tool'},streamed);
  outcomes.push({name:'native tool stream has bounded arguments and one complete terminal; replay adds no dispatch',status:'PASS'});
  const final=await call('qualification3-final-stream','action','gatewayQualification:probe',{...common,mode:'final',call:callResult});
  assertComplete(final,3);assert.equal(final.result.parts.filter(part=>part.type==='tool-call').length,0);
  const text=final.result.parts.filter(part=>part.type==='text-delta').map(part=>part.delta).join('');assert.match(text,/CORTEX_AGENT_TOOL_STREAM_OK/);
  const cached=await replay('qualification3-final-stream-replay',{...common,mode:'final',call:callResult},final);
  assert.equal(cached.result.value.version,1);assert.ok(cached.result.value.content.some(part=>part.type==='text'&&part.text.includes('CORTEX_AGENT_TOOL_STREAM_OK')));
  outcomes.push({name:'tool-result prompt produces bounded final text and typed read-only replay under retained300000 liability',status:'PASS'});
  await context.publish('qualification3-outcomes',{operation,projectId:context.state.projectId,tenantId,memorySpaceId,classification:'actual-service-observation-not-independent-acceptance',
    outcomes,providerDispatches:3,priorFirstGenerate:'qualification2-generate.json',sameOriginalBudgetPreserved:true,replayDispatches:0,sourceCandidate:'deployment-source-manifest.json',originalQualificationsPreserved:true});
}catch(error){await context.publish('qualification3-outcomes',{operation,projectId:context.state.projectId,tenantId,memorySpaceId,outcomes,error:context.publicError(error),status:'FAIL'});throw error;}
finally{await context.close();}
