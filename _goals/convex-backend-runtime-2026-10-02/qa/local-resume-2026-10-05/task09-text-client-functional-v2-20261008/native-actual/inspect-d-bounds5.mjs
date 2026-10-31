import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,qa,sha} from './common.mjs';
const c=await openOwnedContext(),runId='run:58d60233acc0fbfbd1655dabc27f8e0aa2d420571acb170bddd7950d6df63f1e';
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
const bound=payload=>6*Buffer.byteLength(canonical(payload))+64*(payload.messages.length+payload.tools.length)+1024;
try{
 const state=await c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});
 const run=state.runtimeRuns.find(row=>row.runId===runId);assert.ok(run);const snapshot=JSON.parse(run.snapshotCanonical);
 const operations=state.runtimeModelOperations.filter(row=>row.runAccountId===run.runAccountId);
 const model=operations.filter(row=>row.operationKey==='agent.respond');assert.equal(model.length,1);
 const attempts=state.runtimeModelAttempts.filter(row=>row.operationDocumentId===model[0]._id);assert.equal(attempts.length,1);
 const attempt=attempts[0],request=JSON.parse(JSON.parse(attempt.inputProofCanonical).requestCanonical),policy=JSON.parse(attempt.snapshotCanonical);
 const page=await c.admin.function('messages:listMessagesByThreadId','agent',{threadId:snapshot.threadId,order:'asc',paginationOpts:{numItems:100,cursor:null}});
 assert.equal(page.isDone,true);const saved=page.page.filter(row=>row.order===snapshot.anchor.order);
 const pair=saved.filter(row=>row.message?.role==='assistant'||row.message?.role==='tool');
 const normalized=pair.filter(row=>row.status==='success').map(row=>({role:row.message.role,parts:row.message.content.map(part=>{
  if(part.type==='text')return{type:'text',text:part.text.normalize('NFC').replace(/\r\n?/g,'\n').trim()};
  if(part.type==='tool-call')return{type:part.type,toolCallId:part.toolCallId,toolName:part.toolName,input:part.input};
  if(part.type==='tool-result')return{type:part.type,toolCallId:part.toolCallId,toolName:part.toolName,output:part.output};
  throw Error('Unexpected saved private part '+part.type);
 })}));
 assert.ok(normalized.some(row=>row.role==='tool'));const messages=[...request.messages];
 const last=messages[messages.length-1],contextTail=last?.role==='system'&&last.parts.some(part=>part.type==='text'&&part.text.startsWith('Authorized Cortex context'))?messages.pop():undefined;
 messages.push(...normalized);if(contextTail)messages.push(contextTail);
 const payload={messages,tools:request.tools,...request.toolChoice?{toolChoice:request.toolChoice}:{}};
 const firstPayload={messages:request.messages,tools:request.tools,...request.toolChoice?{toolChoice:request.toolChoice}:{}};
 assert.equal(bound(firstPayload),request.inputTokens,'Exact codec replica must match the genuine first admission');
 const dimensions=saved.map(row=>({nativeMessageId:row._id,role:row.message?.role,status:row.status,order:row.order,stepOrder:row.stepOrder,
  canonicalMessageBytes:Buffer.byteLength(canonical(row.message)),canonicalMessageHash:sha(canonical(row.message)),
  parts:Array.isArray(row.message?.content)?row.message.content.map(part=>({type:part.type,toolName:part.toolName,toolCallId:part.toolCallId,
   serializedBytes:Buffer.byteLength(canonical(part)),...part.type==='tool-result'?{outputType:part.output.type,outputBytes:Buffer.byteLength(canonical(part.output)),outputValueKeys:part.output.value&&typeof part.output.value==='object'?Object.keys(part.output.value):[]}:{}})):[]}));
 const result={status:'READ_ONLY_SAVED_D_BOUND_DIAGNOSIS',runId,runState:run.responseStatus,definitionHash:run.definitionHash,policy,
  firstAdmittedRequest:request,firstAttempt:{id:attempt._id,operationId:model[0].operationId,state:attempt.state,slotReleased:attempt.slotReleased,reservationUnits:attempt.reservationUnits},
  savedNativeMessages:saved,dimensions,normalizedSavedSuccessPair:normalized,
  deterministicMeasurement:{scope:'Exact first admitted codec plus actual saved successful native call/result; next rejected request was not durably captured',
   codec:'agent-tools-chat-utf8-v1',firstMeasuredInputTokens:request.inputTokens,firstReplicatedInputTokens:bound(firstPayload),
   continuationPayloadBytes:Buffer.byteLength(canonical(payload)),continuationMessageCount:messages.length,continuationInputBound:bound(payload),
   limit:policy.limits.inputTokens,continuationOutputTokens:request.outputTokens,toolSteps:request.toolSteps,timeoutMs:request.timeoutMs,exceedsInputLimit:bound(payload)>policy.limits.inputTokens},
  paidAttemptCount:state.runtimeModelAttempts.filter(row=>operations.some(op=>op._id===row.operationDocumentId)).length,
  secondModelAdmissionAbsent:true,noModelInvocation:true,noFixtureMutation:true};
 await c.publish('controls5-d-saved-bounds-readonly',result);
 console.log(JSON.stringify({status:result.status,runId,dimensions,measurement:result.deterministicMeasurement,limits:policy.limits,paidAttemptCount:result.paidAttemptCount}));
}catch(error){await c.publish('controls5-d-saved-bounds-failure',{status:'DIAGNOSTIC_FAILURE',error:c.publicError(error)});throw error;}
finally{await c.close();}
