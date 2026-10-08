import assert from 'node:assert/strict';
import {readFile,writeFile,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {openOwnedContext,qa,denied} from './common.mjs';
const c=await openOwnedContext();try{
 const failure=JSON.parse(await readFile(join(qa,'native-control1-failure.json'))),old=JSON.parse(await readFile(join(qa,'native2-inspection-state.json')));assert.equal(failure.outcomes.length,4);assert.ok(failure.outcomes.every(x=>x.status==='PASS'));
 const run=old.runtimeRuns[0];const error=c.publicError(await denied(()=>c.owner.mutation('runtimeAgent:reconcile',{memorySpaceId:c.memorySpaceId,runId:run.runId})));assert.match(JSON.stringify(error),/RECONCILIATION_INCOMPLETE/);
 const current=await c.admin.query('ingestionQualification:state',{tenantId:c.tenantId,memorySpaceId:c.memorySpaceId});
 const ids=new Set(old.runtimeModelAttempts.map(x=>x._id));assert.equal(current.runtimeModelAttempts.filter(x=>ids.has(x._id)).length,ids.size);for(const a of old.runtimeModelAttempts){const b=current.runtimeModelAttempts.find(x=>x._id===a._id);assert.equal(b.state,a.state);assert.equal(b.resultWithheld,a.resultWithheld);assert.equal(b.reservationUnits,a.reservationUnits);assert.equal(b.ordinal,a.ordinal);}
 assert.equal(current.runtimeTranscriptMessages.length,old.runtimeTranscriptMessages.length);assert.equal(current.runtimeIngestionEvents.length,old.runtimeIngestionEvents.length);
 for(const [name,subject] of [['task09-owner-refresh-jwt.txt','cortex-owner'],['task09-foreign-jwt.txt','foreign-user']]){const p=join(c.handoff.privateDirectory,name);await writeFile(p,c.token(subject),{mode:0o600});await chmod(p,0o600);}
 await c.publish('native-control-tail2',{status:'PASS',priorQualifiedGroups:failure.outcomes,newOutcome:{name:'unknown no-save reconciliation correctly denies without inventing final or paid retry',status:'PASS',error},originalAttemptsUnchanged:true,originalTranscriptUnchanged:true,originalEventsUnchanged:true,additionalOtherLaneAttempts:current.runtimeModelAttempts.filter(x=>!ids.has(x._id)).map(x=>({attemptId:x._id,operationId:x.operationDocumentId,state:x.state})),noNewPaidCallByThisControl:true,correctedOnlyPriorReconcileTailOracle:true});console.log(JSON.stringify({status:'PASS',priorGroups:4,newGroup:1}));
}finally{await c.close();}
