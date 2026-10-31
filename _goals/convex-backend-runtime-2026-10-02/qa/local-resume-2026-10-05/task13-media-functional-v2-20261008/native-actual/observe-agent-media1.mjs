/** ONE Root UI turn only: read-only receipt collector; never submit/start/retry/reconcile/release here. */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {openOwnedContext,q,sha,waitUntil} from './common.mjs';
const c=await openOwnedContext(),config=JSON.parse(await readFile(join(q,'agent-media-public-fixture1.json'))),scope={tenantId:config.tenantId,memorySpaceId:config.memorySpaceId};
let client;const releases=[],observations=[],states=[];const started=Date.now();
async function table(name){let cursor=null,rows=[];for(let pageNo=0;pageNo<10;pageNo++){
 const page=await c.admin.query('_system/cli/tableData',{table:name,order:'desc',paginationOpts:{cursor,numItems:100}});
 rows.push(...page.page.filter(row=>row.tenantId===scope.tenantId&&row.memorySpaceId===scope.memorySpaceId));
 if(page.isDone)return rows;cursor=page.continueCursor;
}throw Error('BOUNDED_NATIVE_TABLE_PAGING_EXCEEDED');}
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value[key]!==undefined).map(key=>[key,value[key]]));
const attempts=rows=>rows.map(row=>({...pick(row,['attemptId','operationId','state','ordinal','dispatchIdentity','reservationUnits','measuredInputTokens','maximumOutputTokens','slotReleased','resultWithheld','checkpointAt','terminalEvidenceHash','terminal','resultAttachmentState']),
 result:row.result?{canonicalSha256:sha(JSON.stringify(row.result)),kind:row.result.kind??null,profile:row.result.profile??null,vectorCount:row.result.vectors?.length??null,dimensions:row.result.vectors?.[0]?.length??null}:null}));
try{
 await c.verifyTarget('agent-media-observe1-target-verified');
 const native=await waitUntil('ONE ordinary Root UI run creation',()=>table('runtimeRuns'),value=>value.length>0,{timeoutMs:120000,pollMs:500});
 assert.equal(native.length,1,'This scope accepts only the ONE authorized logical turn');const runId=native[0].runId;
 await c.publish('agent-media-observe1-handle',{status:'SINGLE_ROOT_UI_RUN_OBSERVED',runId,conversationId:native[0].conversationId,scope,observedAt:Date.now(),nativeSubmissions:0});
 console.log(JSON.stringify({status:'ROOT_UI_RUN_OBSERVED',runId,conversationId:native[0].conversationId}));
 const sdk=await import(pathToFileURL(join(c.host,'task13-runtime-entry.mjs')));
 client=new sdk.CortexRuntimeClient({deploymentUrl:c.state.url,assetHttpUrl:c.state.url.replace('.convex.cloud','.convex.site'),scope,fetchToken:async()=>c.token(config.subject)});
 const handle=await client.attach(runId);
 releases.push(client.watchRun(handle,run=>states.push({at:Date.now(),...run}),error=>states.push({at:Date.now(),error:c.publicError(error)})));
 releases.push(client.watchObservation(handle,value=>observations.push({at:Date.now(),...value}),error=>observations.push({at:Date.now(),error:c.publicError(error)}),{limit:100}));
 const terminal=await waitUntil('bounded same run terminal state',()=>client.observe(handle,{limit:100}),value=>['complete','failed','cancelled'].includes(value.run.responseStatus),{timeoutMs:120000,pollMs:500});
 for(const release of releases.splice(0))release();
 const run=await client.get(handle),transcript=await client.messages(run.conversationId,{limit:100});
 const raw=await Promise.all(['runtimeRuns','runtimeAgentExecutions','runtimeAgentIngestion','runtimeAgentOperations','runtimeIngestionEvents','runtimeIngestionStages'].map(table));
 const [runs,executions,receipts,operations,events,stages]=raw,held=await c.admin.query('task13AgentDelay:snapshot',{}),ledger=await c.admin.query('task13Native:snapshot',scope);
 assert.equal(runs.length,1);const scopedEvents=events.filter(row=>row.runId===runId),ids=new Set(scopedEvents.map(row=>row.eventId));
 const record={version:1,status:run.responseStatus==='complete'?'ACTUAL_SINGLE_V2_ROOT_UI_TURN_COMPLETE_READBACK':'ACTUAL_SINGLE_V2_ROOT_UI_TURN_FAILED_OR_CANCELLED',
  startedAt:started,observedAt:Date.now(),scope,runId,handle,run,terminal,transcript,observations,states,held,
  native:{run:runs[0],execution:executions.filter(row=>row.runId===runId),ingestion:receipts.filter(row=>row.runId===runId),operations:operations.filter(row=>row.runId===runId),
   events:scopedEvents,stages:stages.filter(row=>ids.has(row.eventId))},
  ledger:{accounts:ledger.accounts,operations:ledger.operations,attempts:attempts(ledger.attempts),jobs:ledger.jobs,assets:ledger.assets.map(row=>({...row}))},
  candidateManifestSha256:config.candidateManifestSha256,fixtureOverlaySourceManifest:config.fixtureOverlaySourceManifest,
  nativeSubmissions:0,nativeStarts:0,newReadmission:0,initialUserStageHoldBeforeClaim:true,manualReleasePending:true,officialSDKClientClosed:true};
 await client.close();client=undefined;await c.publish('agent-media-observe1-readback',record);
 console.log(JSON.stringify({status:record.status,runId,responseStatus:run.responseStatus,memoryStatus:run.memoryStatus,held:held.map(row=>({eventId:row.eventId,state:row.state,deadlineAt:row.deadlineAt})),
  jobs:ledger.jobs.map(row=>({jobId:row.jobId,state:row.state,artifactId:row.artifactId,assetVersionId:row.assetVersionId,failureCode:row.failureCode})),attempts:ledger.attempts.length}));
}catch(error){await c.publish('agent-media-observe1-outcomes',{status:'FAIL_OR_UNKNOWN',error:c.publicError(error),nativeSubmissions:0,nativeStarts:0,noPaidRetry:true,elapsedMs:Date.now()-started});throw error;}
finally{for(const release of releases)release();if(client)await client.close();await c.close();}
