import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,qa} from './common.mjs';
const c=await openOwnedContext(),runId='run:c58dc73792d56cfd352215df3a356c03c666fc7aeb971b0dd755b2fcd53ced03';
try{
 const state=await c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});
 const run=state.runtimeRuns.find(row=>row.runId===runId);assert.ok(run);
 const b=JSON.parse(await readFile(join(qa,'native3-calls.json'))).records.find(row=>row.label==='new-logical-held-tool-turn');
 const previous=state.runtimeRuns.find(row=>row.runId===b.result.runId),event=state.runtimeIngestionEvents.find(row=>row.runId===previous.runId&&row.lineage.role==='user');
 const extract=state.runtimeIngestionStages.find(row=>row.eventId===event.eventId&&row.stage==='extract'),snapshot=JSON.parse(run.snapshotCanonical);
 assert.equal(run.conversationId,previous.conversationId);assert.equal(previous.responseStatus,'complete');assert.equal(extract.state,'pending');assert.equal(extract.attempt,0);
 const bPin=snapshot.messages.find(row=>previous.inputMessageIds.includes(row.nativeMessageId));assert.ok(bPin);assert.equal(bPin.sourceEventId,event.lineage.sourceEventId);assert.equal(bPin.sourceRevision,event.lineage.sourceRevision);
 const request=JSON.parse(run.requestCanonical).publicRequest,currentText=request.parts.map(row=>row.text).join('\n'),previousText=b.args.request.parts.map(row=>row.text).join('\n');
 const operations=state.runtimeModelOperations.filter(row=>row.runAccountId===run.runAccountId&&row.operationKey==='agent.respond');
 const admitted=[];
 for(const op of operations)for(const attempt of state.runtimeModelAttempts.filter(row=>row.operationDocumentId===op._id)){
  const input=JSON.parse(attempt.inputProofCanonical),validated=JSON.parse(input.requestCanonical),messages=validated.messages??validated.prompt??[];
  const descriptions=messages.map(message=>({role:message.role,content:message.content??message.parts}));
  const rendered=JSON.stringify(descriptions);
  const occurrences=text=>rendered.split(JSON.stringify(text).slice(1,-1)).length-1;
  admitted.push({operationId:op.operationId,attemptId:attempt._id,ordinal:attempt.ordinal,state:attempt.state,measuredInputTokens:attempt.measuredInputTokens,maximumOutputTokens:attempt.maximumOutputTokens,
   inputRequestKeys:Object.keys(validated),messages:descriptions,currentInputOccurrences:occurrences(currentText),completedBInputOccurrences:occurrences(previousText),
   canonicalHash:attempt.hash,slotReleased:attempt.slotReleased,reservationUnits:attempt.reservationUnits});
 }
 const observation=await c.owner.query('runtimeAgent:observe',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId,runId,finalOnly:true});
 const result={status:'READ_ONLY_ACTUAL_TAIL_AND_PROMPT_DIAGNOSIS',runId,conversationId:run.conversationId,run,snapshot,completedBPin:bPin,completedBEvent:event,completedBExtract:extract,
  currentText,previousText,admitted,observation,noModelInvocation:true,noFixtureMutation:true};
 await c.publish('ui-c-tail-and-prompt-diagnosis4',result);
 console.log(JSON.stringify({status:result.status,runId,state:run.responseStatus,BInputInSnapshot:true,BExtractPendingAttempt:extract.attempt,
  admitted:admitted.map(({messages,...row})=>({...row,messageCount:messages.length,roles:messages.map(message=>message.role)})),finalText:observation.parts.filter(row=>row.part.type==='text').map(row=>row.part.text).join('')}));
}finally{await c.close();}
